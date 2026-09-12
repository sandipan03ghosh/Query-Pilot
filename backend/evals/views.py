from rest_framework import generics
from rest_framework.permissions import IsAdminUser, IsAuthenticated

from .models import EvalRun
from .serializers import EvalRunDetailSerializer, EvalRunListSerializer


class EvalRunListView(generics.ListAPIView):
    """Recent eval runs, newest first, for the Evaluation dashboard.

    EvalRun is a deployment-level artifact (created only by the `run_evals`
    management command against the shared sample DB) — it has no per-user owner,
    so there is nothing to scope by user. Read-only, auth required. Summary
    metrics only: `raw_results` is not in this serializer.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = EvalRunListSerializer

    def get_queryset(self):
        qs = EvalRun.objects.all()
        subset = self.request.query_params.get("subset")
        if subset:
            qs = qs.filter(subset=subset)
        try:
            limit = min(int(self.request.query_params.get("limit", 50)), 200)
        except (TypeError, ValueError):
            limit = 50
        return qs[:limit]


class EvalRunDetailView(generics.RetrieveAPIView):
    """Single run WITH `raw_results` (per-case pass/fail breakdown).

    `raw_results` is non-sensitive by contract (case id, category, flags,
    error_type, timings — no SQL/rows/questions), but since EvalRun has no owner
    dimension the strongest meaningful gate is staff-only. The dashboard chart
    uses only the list endpoint.
    """
    permission_classes = [IsAdminUser]
    serializer_class = EvalRunDetailSerializer
    queryset = EvalRun.objects.all()
