from django.core.management.base import BaseCommand, CommandError

from databases.models import ClientDatabase
from llm_agent.semantic.drift_service import compute_drift_metrics


class Command(BaseCommand):
    help = (
        "Compute and persist drift metrics for one or all databases. Purely "
        "observational — writes advisory recommendations only, never triggers "
        "retraining."
    )

    def add_arguments(self, parser):
        parser.add_argument("--database-id", type=int, default=None)

    def handle(self, *args, **options):
        database_id = options.get("database_id")
        databases = ClientDatabase.objects.all()
        if database_id:
            databases = databases.filter(id=database_id)
            if not databases.exists():
                raise CommandError(f"No ClientDatabase with id={database_id}")

        for database in databases:
            metrics = compute_drift_metrics(database)
            if not metrics:
                self.stdout.write(f"[{database.name}] No metrics computed (no recent query history or metadata).")
                continue
            for metric in metrics:
                flag = " [THRESHOLD BREACHED]" if metric.threshold_breached else ""
                self.stdout.write(f"[{database.name}] {metric.metric_type}={metric.value:.3f}{flag}")
