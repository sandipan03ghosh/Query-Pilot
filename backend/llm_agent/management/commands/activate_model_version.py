from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from llm_agent.models import EmbeddingModelVersion


class Command(BaseCommand):
    help = (
        "Activate an imported embedding model version. Exactly one version is "
        "ever active at a time (DB-enforced). This only flips which version is "
        "the source of truth — re-embedding schema elements under it (so its "
        "FAISS index actually exists) is a separate step: run update_embeddings "
        "for each database via the API/UI, or the reembed_database command."
    )

    def add_arguments(self, parser):
        parser.add_argument("version_id", type=int)

    def handle(self, *args, **options):
        version_id = options["version_id"]
        try:
            version = EmbeddingModelVersion.objects.get(id=version_id)
        except EmbeddingModelVersion.DoesNotExist:
            raise CommandError(f"No EmbeddingModelVersion with id={version_id}")

        with transaction.atomic():
            EmbeddingModelVersion.objects.filter(is_active=True).exclude(id=version.id).update(is_active=False)
            version.is_active = True
            version.save(update_fields=["is_active"])

        self.stdout.write(self.style.SUCCESS(
            f"Activated {version.version_tag} (id={version.id}) as the current embedding model."
        ))
