"""
promote_feedback — turn user feedback on past queries into eval / few-shot data.

  - 👍 (feedback='up') + success + non-empty SQL
        -> appended to evals/fixtures/promoted/<database_id>.json
           (read back as few-shot examples by query_examples.similar_examples)
  - 👎 (feedback='down') OR a failed query
        -> appended to evals/fixtures/candidates.json (a review queue; nothing
           consumes it automatically)

Safety notes:
  - Management command only — not importable by any view, runs via
    `python manage.py promote_feedback`.
  - Reads Query fields and writes JSON. It NEVER opens a database connection or
    executes generated SQL (no import of databases.services / DatabaseConnector).
  - Per-database isolation: db id comes from each Query's own session; promoted
    rows are written per database via query_examples.save_examples(db_id, ...),
    which int-coerces the id so the path is always "<digits>.json".
  - Idempotent: a Query already recorded (by id) in the target file is skipped.
"""
import json
import os
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from llm_agent.semantic import query_examples
from session.models import Query

_CANDIDATES_PATH = os.path.join(
    str(settings.BASE_DIR), "evals", "fixtures", "candidates.json"
)


def _load_json_list(path):
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def _write_json_list(path, rows):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        os.replace(tmp, path)
    finally:
        if os.path.isfile(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


class Command(BaseCommand):
    help = "Promote 👍 queries to few-shot examples and queue 👎/failed ones for review."

    def add_arguments(self, parser):
        parser.add_argument("--database-id", type=int, default=None,
                            help="Only process queries for this database.")
        parser.add_argument("--since-days", type=int, default=None,
                            help="Only consider queries created in the last N days.")
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        qs = (
            Query.objects.exclude(feedback__isnull=True)
            .exclude(feedback="")
            .select_related("session")
        )
        if options["since_days"]:
            cutoff = timezone.now() - timedelta(days=options["since_days"])
            qs = qs.filter(created_at__gte=cutoff)
        if options["database_id"]:
            qs = qs.filter(session__database_id=options["database_id"])

        promoted_by_db = {}   # database_id -> list of rows (loaded lazily)
        candidates = _load_json_list(_CANDIDATES_PATH)
        candidate_ids = {c.get("source_query_id") for c in candidates}

        n_promoted = n_queued = n_skipped = 0

        for q in qs:
            db_id = q.session.database_id if q.session else None
            if db_id is None:
                n_skipped += 1
                continue

            good = (
                q.feedback == "up"
                and q.success
                and (q.generated_sql or "").strip()
            )

            if good:
                rows = promoted_by_db.setdefault(
                    db_id, list(query_examples.load_examples(db_id))
                )
                if any(r.get("source_query_id") == q.id for r in rows):
                    n_skipped += 1
                    continue
                rows.append({
                    "database_id": db_id,
                    "question": q.prompt,
                    "sql": q.generated_sql.strip(),
                    "source_query_id": q.id,
                    "promoted_at": timezone.now().isoformat(),
                })
                n_promoted += 1
            else:
                if q.id in candidate_ids:
                    n_skipped += 1
                    continue
                candidates.append({
                    "source_query_id": q.id,
                    "database_id": db_id,
                    "question": q.prompt,
                    "sql": (q.generated_sql or "").strip(),
                    "feedback": q.feedback,
                    "success": q.success,
                    "error_type": q.error_type or "",
                    "queued_at": timezone.now().isoformat(),
                })
                candidate_ids.add(q.id)
                n_queued += 1

        if options["dry_run"]:
            self.stdout.write(
                f"[dry run] would promote {n_promoted}, queue {n_queued}, skip {n_skipped}."
            )
            return

        for db_id, rows in promoted_by_db.items():
            query_examples.save_examples(db_id, rows)
        if n_queued:
            _write_json_list(_CANDIDATES_PATH, candidates)

        self.stdout.write(self.style.SUCCESS(
            f"Promoted {n_promoted} few-shot example(s), queued {n_queued} for review, "
            f"skipped {n_skipped} already-recorded."
        ))
