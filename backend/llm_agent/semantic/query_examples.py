"""
Few-shot example retrieval for the NL->SQL prompt — the read side of the
feedback flywheel.

Store: evals/fixtures/promoted/<database_id>.json, a list of
{database_id, question, sql, source_query_id, promoted_at}.

Trust / reachability:
  - save_examples() is NOT reachable from any request path. The only caller is
    session/management/commands/promote_feedback.py, a management command run by
    an operator; `database_id` there comes from a Query's own session and `rows`
    are built from DB fields, never from request input.
  - `database_id` is coerced with int() before it touches the filesystem, so the
    path is always evals/fixtures/promoted/<digits>.json — no traversal, and a
    write can only ever land on the file for that exact id.
  - The temp file uses a per-process unique suffix and os.replace (atomic on
    POSIX and Windows), so two concurrent writers cannot corrupt a file or see a
    half-written one; the last writer wins for that one database's file.
  - similar_examples() reads ONLY the requested database's file and re-checks
    each row's database_id. Returned text is still untrusted:
    prompts.build_sql_generation_prompt fences + _clean's it and generated SQL
    still passes GuardrailPipeline.
"""
import json
import logging
import os
import re
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)

_PROMOTED_DIR = os.path.join(str(settings.BASE_DIR), "evals", "fixtures", "promoted")

_STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "by", "with",
    "how", "many", "much", "what", "which", "who", "show", "me", "list", "all",
    "count", "number", "total", "sum", "avg", "average", "get", "find", "give",
    "per", "each", "top", "most", "least", "is", "are", "was", "were", "from",
}


def _tokens(text):
    return {
        t for t in re.split(r"[^a-z0-9]+", (text or "").lower())
        if len(t) > 2 and t not in _STOPWORDS
    }


def _path(database_id):
    # int() first: the filename is always "<digits>.json", never attacker text.
    return os.path.join(_PROMOTED_DIR, f"{int(database_id)}.json")


def load_examples(database_id):
    """All promoted rows for one database, or [] — never raises."""
    path = _path(database_id)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            rows = json.load(f)
    except (OSError, json.JSONDecodeError):
        logger.warning("Could not read promoted examples file %s", path)
        return []
    if not isinstance(rows, list):
        return []
    return [
        r for r in rows
        if isinstance(r, dict)
        and r.get("database_id") == int(database_id)   # re-check isolation
        and (r.get("question") or "").strip()
        and (r.get("sql") or "").strip()
    ]


def save_examples(database_id, rows):
    """Atomically replace the promoted-examples file for one database.

    Management-command only (see module docstring) — not for request handlers.
    """
    database_id = int(database_id)
    os.makedirs(_PROMOTED_DIR, exist_ok=True)
    path = _path(database_id)
    tmp = f"{path}.{os.getpid()}.{uuid.uuid4().hex}.tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2)
        os.replace(tmp, path)   # atomic; concurrent writers -> last one wins
    finally:
        if os.path.isfile(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def similar_examples(database_id, question, top_k=5):
    """Up to `top_k` promoted (question, sql) pairs for this database, ranked by
    keyword overlap with `question`. No-overlap / tie falls back to
    most-recently promoted first (load_examples is newest-first)."""
    rows = load_examples(database_id)
    if not rows:
        return []

    q_tokens = _tokens(question)
    scored = []
    for i, row in enumerate(rows):
        overlap = len(q_tokens & _tokens(row["question"])) if q_tokens else 0
        scored.append((overlap, -i, row))   # -i preserves newest-first on ties

    scored.sort(key=lambda s: (s[0], s[1]), reverse=True)
    return [
        {"question": row["question"], "sql": row["sql"]}
        for _overlap, _idx, row in scored[: max(0, int(top_k))]
    ]
