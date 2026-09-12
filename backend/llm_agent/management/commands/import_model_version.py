from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from llm_agent.models import EmbeddingModelVersion, ExperimentRun
from llm_agent.semantic.artifact_validator import validate_artifact, ArtifactValidationError


class Command(BaseCommand):
    help = (
        "Validate and import a Colab-trained embedding model artifact. Only ever "
        "run from a trusted shell/server context — never expose this path as an "
        "HTTP parameter. Creates an inactive EmbeddingModelVersion row; activation "
        "is a separate step (see activate_model_version)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--path", required=True, help="Path to the model directory (weights, tokenizer, manifest.json)")
        parser.add_argument("--experiment-run-id", default=None, help="Optional run_id of a matching ExperimentRun to link this version to")

    def handle(self, *args, **options):
        model_dir = options["path"]
        experiment_run_id = options.get("experiment_run_id")

        try:
            manifest, provider = validate_artifact(model_dir)
        except ArtifactValidationError as e:
            raise CommandError(f"Artifact validation failed — nothing was imported: {e}")

        version_tag = manifest["model_name"]
        if EmbeddingModelVersion.objects.filter(version_tag=version_tag).exists():
            raise CommandError(f"A model version with version_tag={version_tag!r} has already been imported.")

        source_experiment = None
        if experiment_run_id:
            try:
                source_experiment = ExperimentRun.objects.get(run_id=experiment_run_id)
            except ExperimentRun.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f"No ExperimentRun with run_id={experiment_run_id!r} found — importing without linking one."
                ))

        with transaction.atomic():
            version = EmbeddingModelVersion.objects.create(
                version_tag=version_tag,
                model_path=model_dir,
                base_model_name=manifest["base_model"],
                dimension=manifest["embedding_dimension"],
                framework_versions={
                    "python_version": manifest.get("python_version"),
                    "torch_version": manifest.get("torch_version"),
                    "sentence_transformers_version": manifest.get("sentence_transformers_version"),
                    "transformers_version": manifest.get("transformers_version"),
                },
                eval_metrics=manifest.get("eval_metrics", {}),
                checksum=manifest["weights_sha256"],
                is_active=False,
                source_experiment=source_experiment,
            )

        self.stdout.write(self.style.SUCCESS(
            f"Imported {version_tag} (id={version.id}, dimension={version.dimension}) — inactive.\n"
            f"Activate it with: python manage.py activate_model_version {version.id}"
        ))
