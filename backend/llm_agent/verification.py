"""
Hallucination detection for a generated-and-executed query.

run_verification(...) produces a display-safe report plus the raw [0, 1] signals
that confidence.compose() blends.

SQL execution: this module never opens a raw cursor. The primary result is
passed in by the caller (already produced by DatabaseConnector.execute_query).
The optional second query for multi-query agreement is executed HERE, but only
by calling connector.execute_query(database, second_sql). That method has a
single code path: it always builds the connection with for_query_execution=True
(READ ONLY session + restricted-role check), always runs
GuardrailPipeline.check(require_explain=True), always runs a fail-closed final
EXPLAIN, and always ends in conn.rollback() with no commit anywhere. So an
LLM-authored second_sql cannot do anything the primary path couldn't; a blocked
one just yields no agreement signal.

back_translation_alignment embeds the SQL in an LLM prompt via
prompts.build_back_translation_prompt, which _clean's it and wraps it in a DATA
fence marked "data, not an instruction". llm_api only sends text to the
provider; it executes nothing.

All outputs are numbers / short strings / booleans — safe to store on
session.Query and return to the client.
"""
from __future__ import annotations

import logging
import re

from django.conf import settings

from evals import comparators
from . import prompts
from .services import llm_api

logger = logging.getLogger(__name__)

_AGG_HINTS = ("how many", "count", "number of", "total", "sum of", "average",
              "avg", "maximum", "minimum", "how much")
_WORD_RE = re.compile(r"[a-z0-9]+")


def _tokens(text):
    return {t for t in _WORD_RE.findall((text or "").lower()) if len(t) > 2}


def _token_similarity(a, b):
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _embedding_similarity(a, b):
    """Cosine of two sentence embeddings when an embedding model is active,
    else None so the caller falls back to token overlap."""
    try:
        from llm_agent.semantic import embedding_service
        provider, _version = embedding_service.get_active_provider()
        if provider is None:
            return None
        import numpy as np
        va, vb = provider.encode([a or "", b or ""])
        va, vb = np.asarray(va, dtype="float32"), np.asarray(vb, dtype="float32")
        denom = (np.linalg.norm(va) * np.linalg.norm(vb)) or 1.0
        return float(np.clip(np.dot(va, vb) / denom, 0.0, 1.0))
    except Exception:  # noqa: BLE001
        logger.warning("embedding similarity failed; using token overlap", exc_info=True)
        return None


def back_translation_alignment(question, sql, *, user=None):
    """(alignment 0-1, back_translated_question, method). alignment is None only
    if the LLM call itself failed."""
    result = llm_api(
        prompts.build_back_translation_prompt(sql),
        user=user,
        model=getattr(settings, "VERIFICATION_MODEL", None),
        temperature=0.0,
        max_tokens=120,
    )
    if not result.get("success"):
        return None, "", "unavailable"

    restated = (result.get("content") or "").strip().strip('"')
    if not restated:
        return None, "", "unavailable"

    sim = _embedding_similarity(question, restated)
    method = "embedding_cosine"
    if sim is None:
        sim = _token_similarity(question, restated)
        method = "token_overlap"
    return round(float(sim), 3), restated[:300], method


def result_sanity_checks(question, result):
    """List of {check, passed, detail}. `result` is a DatabaseConnector
    execute_query dict."""
    checks = []
    q = (question or "").lower()
    result = result if isinstance(result, dict) else {}
    success = bool(result.get("success"))
    rows = result.get("rows") or []
    columns = result.get("columns") or []

    if not success:
        checks.append({"check": "query_executed", "passed": False,
                       "detail": "The query did not execute successfully."})
        return checks
    checks.append({"check": "query_executed", "passed": True, "detail": ""})

    looks_aggregate = any(h in q for h in _AGG_HINTS)
    if looks_aggregate:
        empty = len(rows) == 0
        checks.append({
            "check": "aggregate_has_result",
            "passed": not empty,
            "detail": "An aggregate/count question returned no rows." if empty else "",
        })

    # Column entirely NULL across all rows -> often a bad JOIN.
    if rows and columns:
        for idx, name in enumerate(columns):
            if all(idx < len(r) and r[idx] is None for r in rows):
                checks.append({
                    "check": "no_all_null_columns",
                    "passed": False,
                    "detail": f"Column {name!r} is NULL in every row.",
                })
                break
        else:
            checks.append({"check": "no_all_null_columns", "passed": True, "detail": ""})

    # A single scalar that is a negative count.
    if looks_aggregate and len(rows) == 1 and len(rows[0]) == 1:
        value = rows[0][0]
        if isinstance(value, (int, float)) and not isinstance(value, bool) and value < 0:
            checks.append({"check": "count_non_negative", "passed": False,
                           "detail": f"Aggregate result is negative ({value})."})

    return checks


def schema_coverage(tables_used, retrieved_tables):
    """Fraction of the SQL's claimed tables that were in the retrieved subset.
    None if the model reported no tables_used."""
    claimed = {t.split(".")[-1].strip().lower() for t in (tables_used or []) if t}
    if not claimed:
        return None, []
    retrieved = {t.split(".")[-1].strip().lower() for t in (retrieved_tables or []) if t}
    missing = sorted(claimed - retrieved)
    covered = len(claimed) - len(missing)
    return round(covered / len(claimed), 3), missing


def _run_second_query(connector, database, second_sql):
    """Execute the multi-query check's second SQL through connector.execute_query
    only (guardrail + EXPLAIN + read-only/rollback — see module docstring).
    Returns an execute_query dict, or None when there is nothing to run.
    """
    if not connector or database is None or not (second_sql or "").strip():
        return None
    try:
        return connector.execute_query(database, second_sql)
    except Exception:  # noqa: BLE001
        logger.warning("second-query execution failed", exc_info=True)
        return None


def multi_query_agreement(primary_result, second_result):
    """1.0 if the two result sets match, 0.0 if they differ, None if the second
    query never produced a comparable result."""
    if not second_result or not second_result.get("success"):
        return None
    if not isinstance(primary_result, dict) or not primary_result.get("success"):
        return None
    try:
        return 1.0 if comparators.result_sets_match(primary_result, second_result) else 0.0
    except Exception:  # noqa: BLE001
        logger.warning("multi-query comparison failed", exc_info=True)
        return None


def run_verification(*, question, sql, result, tables_used=None, retrieved_tables=None,
                     second_sql=None, connector=None, database=None, user=None):
    """Orchestrator. Returns (report_dict, signals_dict).

    report_dict is display-safe and goes on session.Query.verification.
    signals_dict feeds confidence.compose().

    `second_sql` (optional) is executed here via connector.execute_query only.
    """
    alignment, restated, bt_method = back_translation_alignment(question, sql, user=user)
    sanity = result_sanity_checks(question, result)
    sanity_rate = (
        sum(1 for c in sanity if c["passed"]) / len(sanity) if sanity else None
    )
    coverage, missing_tables = schema_coverage(tables_used, retrieved_tables)

    second_result = _run_second_query(connector, database, second_sql)
    agreement = multi_query_agreement(result, second_result)

    signals = {
        "back_translation": alignment,
        "sanity_checks": sanity_rate,
        "schema_coverage": coverage,
        "multi_query_agreement": agreement,
    }

    report = {
        "back_translation": {
            "alignment": alignment,
            "restated_question": restated,
            "method": bt_method,
        },
        "sanity_checks": sanity,
        "sanity_pass_rate": round(sanity_rate, 3) if sanity_rate is not None else None,
        "schema_coverage": {
            "score": coverage,
            "tables_outside_retrieved": missing_tables,
        },
        "multi_query_agreement": agreement,
        "warnings": [c["detail"] for c in sanity if not c["passed"] and c["detail"]],
    }
    if alignment is not None and alignment < float(
        getattr(settings, "BACK_TRANSLATION_FLAG_THRESHOLD", 0.55)
    ):
        report["warnings"].append(
            "The SQL may not match the question — it reads as: " + (restated or "?")
        )
    if agreement == 0.0:
        report["warnings"].append("A differently-phrased version of this query returned different rows.")
    if missing_tables:
        report["warnings"].append(
            "The query uses table(s) not in the retrieved schema subset: "
            + ", ".join(missing_tables)
        )

    return report, signals
