"""
Eval harness — run a single case end to end and score it.

The nl_to_sql result is cached on disk keyed by (question, database_id, salt), so
re-running after non-LLM changes costs 0 LLM calls. use_cache=False forces fresh
generation; run_evals varies the salt by active model tag. Entries carry a
version — a bump or a structurally-invalid entry is regenerated; the cache dir is
0700.

The per-case dicts returned here are the only thing written to
EvalRun.raw_results: ids, flags, error types, timings — no SQL, rows, or questions.

Operator-only: imported by the run_evals management command and the test suite,
never by a view. It is the sole place nl_to_sql runs with enforce_owner=False
(trusted, the harness picks the target database). Every SQL it runs — generated,
gold, adversarial, or hallucination-fixture — goes through
DatabaseConnector.execute_query (guardrails + fail-closed EXPLAIN + read-only
rollback); this module never opens a cursor.
"""
from __future__ import annotations

import hashlib
import json
import os
import time

from django.conf import settings

from databases.services import DatabaseConnector
from llm_agent.services import nl_to_sql
from . import comparators

_CACHE_DIR = os.path.join(str(settings.BASE_DIR), "evals", ".cache")
_CACHE_VERSION = 1


def _ensure_cache_dir():
    os.makedirs(_CACHE_DIR, mode=0o700, exist_ok=True)
    try:
        os.chmod(_CACHE_DIR, 0o700)  # POSIX only
    except OSError:
        pass


def _cache_path(question, database_id, salt):
    key = hashlib.sha256(f"{database_id}|{salt}|{question}".encode("utf-8")).hexdigest()
    return os.path.join(_CACHE_DIR, f"{key}.json")


def _valid_cached(obj):
    if not isinstance(obj, dict):
        return False
    if obj.get("_cache_version") != _CACHE_VERSION:
        return False
    if "success" not in obj:
        return False
    if obj.get("success") and not (
        (obj.get("sql_query") or "").strip()
        or obj.get("answerable") is False
        or obj.get("needs_clarification")
    ):
        return False
    return True


def _generate(question, database_id, salt, use_cache):
    path = _cache_path(question, database_id, salt)
    if use_cache and os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                cached = json.load(f)
        except (OSError, json.JSONDecodeError):
            cached = None
        if _valid_cached(cached):
            cached["_cache_hit"] = True
            return cached

    t0 = time.monotonic()
    # enforce_owner=False: trusted internal call.
    result = nl_to_sql(question, database_id, user=None, enforce_owner=False)
    if not isinstance(result, dict):
        result = {"success": False, "error_type": "generation_error"}
    result["_gen_ms"] = round((time.monotonic() - t0) * 1000, 1)
    result["_cache_hit"] = False
    result["_cache_version"] = _CACHE_VERSION

    try:
        _ensure_cache_dir()
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(result, f)
        os.replace(tmp, path)
    except OSError:
        pass
    return result


def _generation_outcome(gen, case):
    if not gen.get("success"):
        return "gen_error", False, gen.get("error_type", "generation_error")
    if gen.get("answerable") is False:
        return "unanswerable", case.get("answerable") is False, ""
    if gen.get("needs_clarification"):
        return "clarification", case.get("category") == "ambiguous", ""
    if (gen.get("sql_query") or "").strip():
        return "sql", None, ""
    return "gen_error", False, "empty_sql"


def run_golden_case(case, database, *, salt="", use_cache=True):
    connector = DatabaseConnector()
    gen = _generate(case["question"], database.id, salt, use_cache)
    outcome, expectation_met, gen_error_type = _generation_outcome(gen, case)

    row = {
        "id": case["id"],
        "category": case.get("category", ""),
        "cache_hit": bool(gen.get("_cache_hit")),
        "gen_ms": gen.get("_gen_ms"),
        "generation_outcome": outcome,
        "executed": False,
        "execution_match": None,
        "sql_exact_match": None,
        "got_error_type": None,
        "blocked_rule": None,
        "exec_ms": None,
        "used_retrieval": gen.get("used_retrieval"),
        "few_shot_count": gen.get("few_shot_count", 0),
        "gold_ok": None,
    }

    if outcome != "sql":
        row["execution_match"] = bool(expectation_met) if expectation_met is not None else False
        row["got_error_type"] = gen_error_type or None
        return row

    ordered = bool(case.get("ordered", False))
    got = connector.execute_query(database, gen["sql_query"], nl_question=case["question"])
    gold = connector.execute_query(database, case["gold_sql"])

    row["executed"] = True
    row["exec_ms"] = got.get("execution_time")
    row["got_error_type"] = got.get("error_type")
    row["blocked_rule"] = got.get("blocked_rule")
    row["gold_ok"] = bool(gold.get("success"))

    if not gold.get("success"):
        row["execution_match"] = None
        row["got_error_type"] = "gold_query_failed"
        return row

    row["execution_match"] = comparators.result_sets_match(got, gold, ordered=ordered)
    row["sql_exact_match"] = comparators.sql_normalized_match(gen["sql_query"], case["gold_sql"])
    return row


def run_adversarial_case(case, database):
    """Expect the guardrail pipeline to block this input."""
    connector = DatabaseConnector()
    result = connector.execute_query(database, case["sql"], nl_question=None)
    blocked = result.get("error_type") == "blocked_statement"
    expected_rule = case.get("expected_rule")
    rule_ok = (expected_rule is None) or (result.get("blocked_rule") == expected_rule)
    return {
        "id": case["id"],
        "blocked": blocked,
        "rule_ok": blocked and rule_ok,
        "blocked_rule": result.get("blocked_rule"),
        "expected_rule": expected_rule,
    }


def run_hallucination_case(case, database, *, salt="", use_cache=True):
    """Run the verification layer against a labelled (question, sql) pair and
    decide whether it gets flagged.

    A 'bad' pair SHOULD be flagged (recall); a 'good' pair should NOT (FPR).
    The fixture SQL is executed only through connector.execute_query (guardrailed).
    """
    from llm_agent import verification, confidence

    connector = DatabaseConnector()
    sql = case["sql"]
    result = connector.execute_query(database, sql, nl_question=case.get("question"))

    report, signals = verification.run_verification(
        question=case["question"], sql=sql, result=result,
        tables_used=None, retrieved_tables=None,
        second_sql=None, connector=None, database=None,
    )
    signals["syntax_valid"] = 1.0 if result.get("error_type") != "syntax_error" else 0.0
    conf = confidence.compose(signals)

    flagged = bool(report.get("warnings")) or ("low_confidence" in conf.get("flags", []))
    return {
        "id": case["id"],
        "label": case.get("label"),
        "flagged": flagged,
        "confidence": conf.get("score"),
        "alignment": report["back_translation"]["alignment"],
        "executed": bool(result.get("success")),
        "skipped": False,
    }
