from django.core.management.base import BaseCommand, CommandError

from databases.models import ClientDatabase
from llm_agent.semantic.semantic_graph import compute_semantic_graph


class Command(BaseCommand):
    help = "Compute the semantic relationship graph for one or all databases, using the active embedding model."

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
            _count, message = compute_semantic_graph(database)
            self.stdout.write(f"[{database.name}] {message}")
