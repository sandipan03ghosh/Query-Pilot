import json
import os

import sqlparse
from sqlparse.sql import Identifier, IdentifierList
from sqlparse.tokens import Keyword

from django.core.management.base import BaseCommand
from django.utils.dateparse import parse_date
from django.utils import timezone

from databases.models import ClientDatabase, TableMetadata
from session.models import Query
from llm_agent.models import TrainingDataSnapshot


def _extract_table_names(sql):
    """
    Heuristic extraction of table names referenced in a SQL string's FROM/JOIN/
    INTO/UPDATE clauses, using sqlparse. This is a best-effort heuristic for
    gathering fine-tuning signal — not a full SQL parser, and it is not used
    anywhere security-relevant (see databases/services.py's
    _validate_single_safe_statement for the actual execution-time guard).
    """
    names = set()
    if not sql:
        return names

    for statement in sqlparse.parse(sql):
        expect_table = False
        for token in statement.tokens:
            if token.is_whitespace:
                continue
            if expect_table:
                if isinstance(token, IdentifierList):
                    for identifier in token.get_identifiers():
                        name = identifier.get_real_name()
                        if name:
                            names.add(name)
                elif isinstance(token, Identifier):
                    name = token.get_real_name()
                    if name:
                        names.add(name)
                expect_table = False
                continue
            if token.ttype is Keyword and token.value.upper() in ("FROM", "JOIN", "INTO", "UPDATE"):
                expect_table = True
    return names


def _build_schema_text(name, schema_name=None, description=None, columns=None):
    """
    Linearize a schema element into the fixed template used at both training
    and inference time — embedding_service.py must build text with this exact
    same shape, or the two embedding spaces won't be comparable.
    """
    parts = [f"table: {schema_name}.{name}" if schema_name else f"table: {name}"]
    if columns:
        parts.append(f"columns: {', '.join(columns)}")
    if description:
        parts.append(f"description: {description}")
    return " | ".join(parts)


class Command(BaseCommand):
    help = (
        "Export a JSONL training dataset of (query, positive schema element) pairs "
        "for embedding fine-tuning in Colab. Writes exports/train_<timestamp>.jsonl "
        "by default and records a TrainingDataSnapshot row."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--since", type=str, default=None,
            help="Only include queries created on/after this date (YYYY-MM-DD)",
        )
        parser.add_argument(
            "--database-id", type=int, default=None,
            help="Restrict export to a single ClientDatabase id",
        )
        parser.add_argument(
            "--out", type=str, default=None,
            help="Output JSONL path, any location (default: exports/train_<timestamp>.jsonl)",
        )

    def handle(self, *args, **options):
        since = options.get("since")
        database_id = options.get("database_id")
        out_path = options.get("out")

        since_date = None
        if since:
            since_date = parse_date(since)
            if since_date is None:
                self.stderr.write(self.style.ERROR(f"Invalid --since date: {since!r} (expected YYYY-MM-DD)"))
                return

        if not out_path:
            out_dir = os.path.join(os.getcwd(), "exports")
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, f"train_{timezone.now().strftime('%Y-%m-%d_%H%M%S')}.jsonl")
        else:
            out_dir = os.path.dirname(os.path.abspath(out_path))
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)

        databases_qs = ClientDatabase.objects.all()
        if database_id:
            databases_qs = databases_qs.filter(id=database_id)
        valid_database_ids = set(databases_qs.values_list("id", flat=True))

        row_count = 0
        earliest = None
        latest = None
        databases_with_real_pairs = set()

        with open(out_path, "w", encoding="utf-8") as out_file:

            def write_pair(query_text, positive):
                nonlocal row_count
                out_file.write(json.dumps({"query": query_text, "positive": positive}, ensure_ascii=False) + "\n")
                row_count += 1

            # --- Real usage pairs: successful queries with generated SQL ---
            queries = (
                Query.objects.filter(success=True, generated_sql__isnull=False)
                .exclude(generated_sql="")
                .select_related("session")
            )
            if since_date:
                queries = queries.filter(created_at__date__gte=since_date)

            for query in queries.iterator():
                db_id = query.session.database_id
                if db_id is None or db_id not in valid_database_ids:
                    continue

                table_names = _extract_table_names(query.generated_sql)
                if not table_names:
                    continue

                tables = TableMetadata.objects.filter(database_id=db_id, table_name__in=table_names)
                matched_any = False
                for table in tables:
                    column_names = list(table.columns.values_list("column_name", flat=True))
                    write_pair(query.prompt, {
                        "type": "table",
                        "schema": table.schema_name,
                        "table": table.table_name,
                        "column": None,
                        "text": _build_schema_text(table.table_name, table.schema_name, table.description, column_names),
                    })
                    matched_any = True

                if matched_any:
                    databases_with_real_pairs.add(db_id)
                    if earliest is None or query.created_at < earliest:
                        earliest = query.created_at
                    if latest is None or query.created_at > latest:
                        latest = query.created_at

            # --- Schema-only bootstrap pairs for databases with no usable query history yet ---
            for database in databases_qs:
                if database.id in databases_with_real_pairs:
                    continue
                for table in TableMetadata.objects.filter(database=database).prefetch_related("columns"):
                    column_names = [c.column_name for c in table.columns.all()]
                    write_pair(None, {
                        "type": "table",
                        "schema": table.schema_name,
                        "table": table.table_name,
                        "column": None,
                        "text": _build_schema_text(table.table_name, table.schema_name, table.description, column_names),
                    })
                    for column in table.columns.all():
                        write_pair(None, {
                            "type": "column",
                            "schema": table.schema_name,
                            "table": table.table_name,
                            "column": column.column_name,
                            "text": _build_schema_text(
                                f"{table.table_name}.{column.column_name}",
                                table.schema_name,
                                column.description,
                            ),
                        })

        if row_count == 0:
            if os.path.exists(out_path):
                try:
                    os.remove(out_path)
                except OSError:
                    self.stdout.write(self.style.WARNING(f"Could not remove empty export file at {out_path}"))
            self.stdout.write(self.style.WARNING(
                "No training pairs generated — no matching query history or extracted metadata found."
            ))
            return

        TrainingDataSnapshot.objects.create(
            export_path=out_path,
            row_count=row_count,
            date_range_start=earliest,
            date_range_end=latest,
        )

        self.stdout.write(self.style.SUCCESS(f"Exported {row_count} training pairs to {out_path}"))
