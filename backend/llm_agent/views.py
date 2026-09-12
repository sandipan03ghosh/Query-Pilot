import logging
from django.db import transaction
from django.shortcuts import render, get_object_or_404
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .services import nl_to_sql, get_metadata_description
from .models import EmbeddingModelVersion, ExperimentRun, DriftMetric, Embedding
from .serializers import (
    EmbeddingModelVersionSerializer, ExperimentRunSerializer, DriftMetricSerializer,
    NLQuerySerializer, RunQuerySerializer,
)
from databases.models import ClientDatabase, TableMetadata, ColumnMetadata
from databases.services import DatabaseConnector

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_sql_from_nl(request):
    """Convert a natural-language question into candidate SQL.

    Does NOT execute anything — the returned SQL is a candidate. nl_to_sql
    enforces that request.user owns database_id.
    """
    input_serializer = NLQuerySerializer(data=request.data)
    input_serializer.is_valid(raise_exception=True)
    natural_language_query = input_serializer.validated_data['query']
    database_id = input_serializer.validated_data['database_id']

    result = nl_to_sql(natural_language_query, database_id, user=request.user)

    if not result.get('success'):
        return Response(
            {
                'error': result.get('error', 'Unknown error generating SQL'),
                'error_type': result.get('error_type', 'generation_error'),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if result.get('needs_clarification'):
        return Response({
            'needs_clarification': True,
            'interpretations': result.get('interpretations', []),
        })

    if result.get('answerable') is False:
        return Response({
            'answerable': False,
            'message': result.get('message', ''),
            'explanation': result.get('explanation', ''),
        })

    logger.debug(
        "Generated SQL for database_id=%s: sql_length=%d",
        database_id, len(result.get('sql_query', '')),
    )
    return Response({
        'sql_query': result.get('sql_query', ''),
        'explanation': result.get('explanation', ''),
        'tables_used': result.get('tables_used', []),
        'columns_used': result.get('columns_used', []),
        'self_reported_confidence': result.get('self_reported_confidence'),
    })


def _display_safe_result(exec_result):
    """Trim an execute_query dict to what the client should see. Drops
    explain_plan unless settings.EXPOSE_EXPLAIN_PLAN (which itself defaults off in
    production) — plans can reveal schema/filter detail."""
    from django.conf import settings
    from databases.serializers import QueryResultSerializer

    data = dict(exec_result or {})
    if not getattr(settings, "EXPOSE_EXPLAIN_PLAN", False):
        data.pop("explain_plan", None)
    return QueryResultSerializer(data).data


def _persist_run(*, user, session_id, question, payload, exec_result):
    """Log one /api/llm/query/ run into a session's history, if session_id is
    given and owned by `user`. Writes only display-safe summaries onto the Query
    row (see session.models.Query). Returns the Query id or None."""
    if not session_id:
        return None
    from session.models import Session, Query

    try:
        session = Session.objects.get(pk=session_id, user=user)
    except Session.DoesNotExist:
        return None

    confidence = payload.get("confidence") or {}
    verification = payload.get("verification") or {}
    sql = payload.get("sql_query", "")
    success = bool(exec_result.get("success"))
    rows = exec_result.get("rows") or []
    parts = [f"**SQL**\n```sql\n{sql}\n```"]
    if payload.get("explanation"):
        parts.append(payload["explanation"])
    parts.append(
        f"**Result:** {len(rows)} row(s)" if success
        else f"**Blocked/failed:** {exec_result.get('status', 'error')}"
    )
    if confidence.get("score") is not None:
        parts.append(f"Confidence: {confidence['score']}/100")

    query = Query.objects.create(
        session=session,
        prompt=question,
        response="\n\n".join(parts),
        success=success,
        error_type=None if success else (exec_result.get("error_type") or "execution_error"),
        error=None if success else exec_result.get("status", ""),
        generated_sql=sql,
        explanation=payload.get("explanation", ""),
        confidence_score=confidence.get("score"),
        confidence_breakdown=confidence.get("breakdown"),
        guardrail_warnings=payload.get("guardrail_warnings") or [],
        verification={k: v for k, v in verification.items() if k != "sanity_checks"} or None,
    )
    session.save()  # bump updated_at only once the row exists
    return query.id


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_query(request):
    """Combined pipeline: NL question -> retrieve -> generate (structured) ->
    guardrails + sandboxed execute -> back-translation / sanity / (optional)
    multi-query verification -> confidence.

    Ownership: nl_to_sql enforces request.user owns database_id; the database is
    re-fetched owner-scoped before execution; any session_id is checked against
    request.user. Nothing here runs SQL except through
    DatabaseConnector.execute_query.
    """
    from django.conf import settings
    from . import confidence as confidence_mod
    from . import verification as verification_mod
    from .services import nl_to_sql

    serializer = RunQuerySerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    question = serializer.validated_data["query"]
    database_id = serializer.validated_data["database_id"]
    session_id = serializer.validated_data.get("session_id")
    deep = serializer.validated_data.get("deep", False)

    gen = nl_to_sql(question, database_id, user=request.user)
    if not gen.get("success"):
        return Response(
            {"error": gen.get("error", "SQL generation failed."),
             "error_type": gen.get("error_type", "generation_error")},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if gen.get("needs_clarification"):
        return Response({"needs_clarification": True,
                         "interpretations": gen.get("interpretations", [])})
    if gen.get("answerable") is False:
        return Response({"answerable": False,
                         "message": gen.get("message", ""),
                         "explanation": gen.get("explanation", "")})

    sql = gen["sql_query"]
    try:
        database = ClientDatabase.objects.get(id=database_id, owner=request.user)
    except ClientDatabase.DoesNotExist:
        return Response({"error": "Database not found.", "error_type": "database_not_found"},
                        status=status.HTTP_404_NOT_FOUND)

    connector = DatabaseConnector()
    exec_result = connector.execute_query(
        database, sql, user=request.user, nl_question=question,
    )

    second_sql = None
    want_multi = deep or getattr(settings, "VERIFICATION_MULTI_QUERY", False)
    if want_multi and exec_result.get("success"):
        variant = nl_to_sql(question, database_id, user=request.user, variant=True)
        if variant.get("success"):
            second_sql = (variant.get("sql_query") or "").strip() or None

    report, signals = verification_mod.run_verification(
        question=question, sql=sql, result=exec_result,
        tables_used=gen.get("tables_used"), retrieved_tables=gen.get("retrieved_tables"),
        second_sql=second_sql, connector=connector, database=database, user=request.user,
    )
    signals["syntax_valid"] = 1.0 if exec_result.get("error_type") != "syntax_error" else 0.0
    conf = confidence_mod.compose(signals)

    payload = {
        "sql_query": sql,
        "explanation": gen.get("explanation", ""),
        "tables_used": gen.get("tables_used", []),
        "columns_used": gen.get("columns_used", []),
        "used_retrieval": gen.get("used_retrieval"),
        "few_shot_count": gen.get("few_shot_count", 0),
        "results": _display_safe_result(exec_result),
        "guardrail_warnings": exec_result.get("guardrail_warnings", []),
        "confidence": conf,
        "verification": report,
        "needs_clarification": False,
    }
    payload["query_id"] = _persist_run(
        user=request.user, session_id=session_id, question=question,
        payload=payload, exec_result=exec_result,
    )
    return Response(payload)


class ModelVersionListView(generics.ListAPIView):
    """List all imported embedding model versions."""
    queryset = EmbeddingModelVersion.objects.all()
    serializer_class = EmbeddingModelVersionSerializer
    permission_classes = [IsAuthenticated]


class ModelVersionDetailView(generics.RetrieveAPIView):
    queryset = EmbeddingModelVersion.objects.all()
    serializer_class = EmbeddingModelVersionSerializer
    permission_classes = [IsAuthenticated]


class ActivateModelVersionView(APIView):
    """Atomically activates a model version (and deactivates any other),
    mirroring the activate_model_version management command."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        try:
            version = EmbeddingModelVersion.objects.get(id=pk)
        except EmbeddingModelVersion.DoesNotExist:
            return Response({"detail": "Model version not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            EmbeddingModelVersion.objects.filter(is_active=True).exclude(id=version.id).update(is_active=False)
            version.is_active = True
            version.save(update_fields=["is_active"])

        return Response(EmbeddingModelVersionSerializer(version).data)


class ExperimentRunListView(generics.ListAPIView):
    queryset = ExperimentRun.objects.all()
    serializer_class = ExperimentRunSerializer
    permission_classes = [IsAuthenticated]


class ExperimentRunDetailView(generics.RetrieveAPIView):
    queryset = ExperimentRun.objects.all()
    serializer_class = ExperimentRunSerializer
    permission_classes = [IsAuthenticated]


class DriftMetricsListView(generics.ListAPIView):
    """Drift metrics, optionally filtered by ?database_id=. Only ever shows
    metrics for databases the requesting user owns."""
    serializer_class = DriftMetricSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = DriftMetric.objects.filter(database__owner=self.request.user)
        database_id = self.request.query_params.get('database_id')
        if database_id:
            queryset = queryset.filter(database_id=database_id)
        return queryset


class EmbeddingProjectionView(APIView):
    """
    2D PCA projection (via numpy SVD, no extra dependency) of a database's
    embeddings under the currently active model version, for the Embedding
    Evolution Visualization. To inspect a different version, activate it
    first — this intentionally doesn't support comparing an inactive version
    to avoid loading multiple large models into memory at once.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        database_id = request.query_params.get('database_id')
        if not database_id:
            return Response({"detail": "database_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            database = ClientDatabase.objects.get(id=database_id, owner=request.user)
        except ClientDatabase.DoesNotExist:
            return Response({"detail": "Database not found."}, status=status.HTTP_404_NOT_FOUND)

        import numpy as np
        from .semantic import embedding_service

        provider, version = embedding_service.get_active_provider()
        if provider is None:
            return Response({"detail": "No active embedding model version."}, status=status.HTTP_400_BAD_REQUEST)

        embeddings = list(Embedding.objects.filter(database=database, model_version=version))

        texts = []
        valid_embeddings = []
        for embedding in embeddings:
            text = embedding_service.resolve_owner_text(embedding)
            if text is not None:
                texts.append(text)
                valid_embeddings.append(embedding)

        if len(texts) < 2:
            return Response({"points": [], "model_version": version.version_tag})

        vectors = np.asarray(provider.encode(texts))
        centered = vectors - vectors.mean(axis=0)
        _u, _s, vt = np.linalg.svd(centered, full_matrices=False)
        projection = centered @ vt[:2].T

        points = [
            {
                "id": embedding.id,
                "type": embedding.owner_type,
                "owner_id": embedding.owner_id,
                "x": float(projection[i][0]),
                "y": float(projection[i][1]),
            }
            for i, embedding in enumerate(valid_embeddings)
        ]

        return Response({"points": points, "model_version": version.version_tag})
