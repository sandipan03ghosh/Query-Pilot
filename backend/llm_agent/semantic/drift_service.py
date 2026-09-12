"""
Semantic Drift Detection. Purely observational: computes metrics and writes an
advisory `recommendation` string onto a DriftMetric row. A human reads these on
the Evaluation dashboard and decides what to do — refresh schema metadata,
promote more feedback examples, or re-run the eval suite to check accuracy.
"""
import logging
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

SUCCESS_RATE_THRESHOLD = 0.7
SCHEMA_STALENESS_DAYS_THRESHOLD = 30
LOOKBACK_DAYS = 14


def compute_query_success_rate(database_obj):
    from session.models import Query

    since = timezone.now() - timedelta(days=LOOKBACK_DAYS)
    queries = (
        Query.objects.filter(session__database_id=database_obj.id, created_at__gte=since)
        .exclude(generated_sql__isnull=True)
        .exclude(generated_sql="")
    )

    total = queries.count()
    if total == 0:
        return None

    successful = queries.filter(success=True).count()
    return successful / total


def compute_schema_staleness_days(database_obj):
    """Days since metadata was last (re-)extracted — a crude proxy for how
    likely the live schema has drifted from what embeddings were built on."""
    if not database_obj.last_metadata_update:
        return None
    return (timezone.now() - database_obj.last_metadata_update).days


def compute_drift_metrics(database_obj):
    """Computes and persists this database's current drift metrics. Returns
    the list of created DriftMetric rows. Never calls into training code."""
    from llm_agent.models import DriftMetric
    from llm_agent.semantic import embedding_service

    _, version = embedding_service.get_active_provider()
    created = []

    success_rate = compute_query_success_rate(database_obj)
    if success_rate is not None:
        breached = success_rate < SUCCESS_RATE_THRESHOLD
        created.append(DriftMetric.objects.create(
            database=database_obj,
            model_version=version,
            metric_type="query_success_rate",
            value=success_rate,
            threshold_breached=breached,
            recommendation=(
                f"Query success rate over the last {LOOKBACK_DAYS} days is {success_rate:.0%}, "
                f"below the {SUCCESS_RATE_THRESHOLD:.0%} threshold — review failed queries "
                f"(promote_feedback), refresh schema metadata, and re-run the eval suite."
                if breached else ""
            ),
        ))

    staleness_days = compute_schema_staleness_days(database_obj)
    if staleness_days is not None:
        breached = staleness_days > SCHEMA_STALENESS_DAYS_THRESHOLD and version is not None
        created.append(DriftMetric.objects.create(
            database=database_obj,
            model_version=version,
            metric_type="schema_change_volume",
            value=float(staleness_days),
            threshold_breached=breached,
            recommendation=(
                f"Schema metadata was last refreshed {staleness_days} days ago — consider "
                f"re-extracting metadata and re-embedding to keep retrieval accurate."
                if breached else ""
            ),
        ))

    return created
