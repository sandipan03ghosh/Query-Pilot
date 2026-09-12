import json

from django.core.management.base import BaseCommand, CommandError
from django.utils.dateparse import parse_datetime

from llm_agent.models import ExperimentRun, TrainingDataSnapshot


class Command(BaseCommand):
    help = (
        "Import an experiment-run record exported from a Colab training/eval "
        "notebook (a small metadata JSON file — run_id, hyperparameters, "
        "metrics, timestamps, notebook URL). Does not import model weights; "
        "that's import_model_version's job."
    )

    def add_arguments(self, parser):
        parser.add_argument("--metadata-path", required=True, help="Path to the experiment-run metadata JSON file")
        parser.add_argument("--dataset-snapshot-id", type=int, default=None, help="Optional TrainingDataSnapshot id this run was trained on")

    def handle(self, *args, **options):
        metadata_path = options["metadata_path"]
        dataset_snapshot_id = options.get("dataset_snapshot_id")

        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            raise CommandError(f"Could not read experiment metadata file: {e}")

        run_id = data.get("run_id")
        if not run_id:
            raise CommandError("Metadata file is missing required field: run_id")

        if ExperimentRun.objects.filter(run_id=run_id).exists():
            raise CommandError(f"An ExperimentRun with run_id={run_id!r} has already been imported.")

        dataset_snapshot = None
        if dataset_snapshot_id:
            try:
                dataset_snapshot = TrainingDataSnapshot.objects.get(id=dataset_snapshot_id)
            except TrainingDataSnapshot.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"No TrainingDataSnapshot with id={dataset_snapshot_id} found — importing without linking one."
                ))

        run = ExperimentRun.objects.create(
            run_id=run_id,
            dataset_snapshot=dataset_snapshot,
            hyperparameters=data.get("hyperparameters", {}),
            metrics=data.get("metrics", {}),
            colab_notebook_url=data.get("colab_notebook_url", ""),
            status=data.get("status", "completed"),
            started_at=parse_datetime(data["started_at"]) if data.get("started_at") else None,
            finished_at=parse_datetime(data["finished_at"]) if data.get("finished_at") else None,
        )

        self.stdout.write(self.style.SUCCESS(f"Imported ExperimentRun {run_id} (id={run.id})"))
