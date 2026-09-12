"""
Guardrail pipeline — app layer of defense in depth (the others: the SELECT-only
PG role from `create_readonly_role`, and the READ ONLY transaction execute_query
uses). Every SQL statement passes here before execute_query runs it.

sqlparse is a non-validating tokenizer: it splits statements, strips comments and
labels tokens, but does not know PostgreSQL grammar. Real validation is EXPLAIN
(rule_explain_row_estimate) then execution. The keyword rules are a coarse
allow/deny gate, not a parser.

Under settings.IS_PRODUCTION the _PRODUCTION_LOCKED rules can't be disabled,
explain_row_estimate_fail_open is forced False, and check() forces
require_explain=True.

Rules run in order and return GuardrailResult; the pipeline stops at the first
rejection. A rule may rewrite the SQL (row-limit appends LIMIT); the rewritten
SQL is what executes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Optional

import sqlparse
from sqlparse.sql import Parenthesis
from sqlparse.tokens import Keyword

logger = logging.getLogger(__name__)

# Deliberately opt a call out of the row-estimate rule (tests, offline analysis).
# No default — callers must choose. Refused in production (require_explain forced).
EXPLAIN_UNAVAILABLE = None

# Blocked outright: DDL, admin/maintenance commands, and DO (an anonymous code
# block can smuggle SQL past a leading-keyword check).
BLOCKED_STATEMENT_KEYWORDS = frozenset({
    "DROP", "ALTER", "CREATE", "TRUNCATE", "GRANT", "REVOKE",
    "COMMENT", "ANALYZE", "VACUUM", "COPY", "CALL", "EXEC", "EXECUTE", "DO",
    "PRAGMA", "ATTACH", "DETACH", "SET", "RESET", "LOCK", "CLUSTER", "REINDEX",
    "REFRESH", "SECURITY", "PREPARE", "DEALLOCATE", "LISTEN", "NOTIFY",
})

WRITE_KEYWORDS = frozenset({"INSERT", "UPDATE", "DELETE", "MERGE", "UPSERT"})

# Config keys a production deployment may not change. A prod connection that
# legitimately needs writes should use a non-production settings profile.
_PRODUCTION_LOCKED = {
    "single_statement": True,
    "syntax_valid": True,
    "block_ddl": True,
    "block_writes": True,
    "explain_row_estimate": True,
    "explain_row_estimate_fail_open": False,
}


@dataclass
class GuardrailResult:
    ok: bool
    rule: str
    reason: str = ""
    rewritten_sql: Optional[str] = None


@dataclass
class GuardrailReport:
    passed: bool
    sql: str                       # possibly rewritten / comment-stripped
    blocked_rule: str = ""
    blocked_reason: str = ""
    warnings: list = field(default_factory=list)   # [{rule, message}] — display-safe


def _strip_comments(sql):
    """Strip comments so hidden keywords can't slip past and depth counting isn't skewed."""
    try:
        return sqlparse.format(sql, strip_comments=True).strip()
    except Exception:  # noqa: BLE001 - normalization must not crash the pipeline
        return sql


def _statements(sql):
    return [s for s in sqlparse.parse(sql) if s.token_first(skip_cm=True) is not None]


def _leading_keyword(statement):
    tok = statement.token_first(skip_cm=True)
    return tok.value.strip().upper() if tok else ""


def _iter_keywords(statement):
    """Yield upper-cased Keyword tokens only — string/identifier contents are
    tagged String/Name, so a literal like note = 'DROP TABLE x' yields nothing."""
    for token in statement.flatten():
        if token.ttype is not None and token.ttype in Keyword:
            yield token.value.strip().upper()


def _max_paren_depth(statement):
    def depth(node, current=0):
        deepest = current
        for child in getattr(node, "tokens", []):
            if isinstance(child, Parenthesis):
                deepest = max(deepest, depth(child, current + 1))
            elif hasattr(child, "tokens"):
                deepest = max(deepest, depth(child, current))
        return deepest
    return depth(statement)


def _has_limit(statement):
    return any(kw == "LIMIT" for kw in _iter_keywords(statement))


# --------------------------------------------------------------------------- #
# Rules                                                                        #
# --------------------------------------------------------------------------- #

def rule_single_statement(sql, ctx):
    stmts = _statements(sql)
    if not stmts:
        return GuardrailResult(False, "single_statement", "No SQL statement provided.")
    if len(stmts) > 1:
        return GuardrailResult(
            False, "single_statement",
            "Only a single SQL statement is allowed per request.",
        )
    return GuardrailResult(True, "single_statement")


def rule_syntax_valid(sql, ctx):
    """Not PostgreSQL validation — only checks a leading statement keyword exists."""
    stmts = _statements(sql)
    if not stmts or _leading_keyword(stmts[0]) == "":
        return GuardrailResult(False, "syntax_valid", "Could not parse a SQL statement.")
    return GuardrailResult(True, "syntax_valid")


def rule_block_ddl(sql, ctx):
    stmt = _statements(sql)[0]
    lead = _leading_keyword(stmt)
    if lead in BLOCKED_STATEMENT_KEYWORDS:
        return GuardrailResult(False, "block_ddl", f"{lead} statements are not allowed.")
    for kw in _iter_keywords(stmt):
        if kw in BLOCKED_STATEMENT_KEYWORDS:
            return GuardrailResult(
                False, "block_ddl", f"Statement contains a disallowed keyword: {kw}.",
            )
    return GuardrailResult(True, "block_ddl")


def rule_block_writes(sql, ctx):
    if ctx.get("read_only") is False:
        return GuardrailResult(True, "block_writes")  # writes deliberately allowed
    stmt = _statements(sql)[0]
    lead = _leading_keyword(stmt)
    if lead in WRITE_KEYWORDS:
        return GuardrailResult(
            False, "block_writes",
            f"{lead} is a write operation and this connection is read-only.",
        )
    for kw in _iter_keywords(stmt):
        if kw in WRITE_KEYWORDS:
            return GuardrailResult(
                False, "block_writes",
                f"Statement contains a write keyword ({kw}) and this connection is read-only.",
            )
    return GuardrailResult(True, "block_writes")


def rule_enforce_row_limit(sql, ctx):
    stmt = _statements(sql)[0]
    if _leading_keyword(stmt) != "SELECT" or _has_limit(stmt):
        return GuardrailResult(True, "enforce_row_limit")
    max_rows = int(ctx.get("max_rows", 1000))
    rewritten = f"{sql.rstrip().rstrip(';')}\nLIMIT {max_rows}"
    return GuardrailResult(
        True, "enforce_row_limit",
        reason=f"No LIMIT present; capped at {max_rows} rows.",
        rewritten_sql=rewritten,
    )


def rule_max_subquery_depth(sql, ctx):
    stmt = _statements(sql)[0]
    depth = _max_paren_depth(stmt)
    limit = int(ctx.get("max_depth", 3))
    if depth > limit:
        return GuardrailResult(
            False, "max_subquery_depth",
            f"Query nesting depth {depth} exceeds the limit of {limit}.",
        )
    return GuardrailResult(True, "max_subquery_depth")


def rule_explain_row_estimate(sql, ctx):
    """Fails closed. ctx['explain'] is callable(sql) -> estimated rows, or None
    when a caller opted out (only allowed if ctx['require_explain'] is False).

    - None                     -> abstain.
    - raises / returns None     -> BLOCK, unless explain_row_estimate_fail_open.
    - estimate over the cap     -> BLOCK.
    """
    explain = ctx.get("explain")
    if explain is None:
        return GuardrailResult(True, "explain_row_estimate")

    fail_open = bool(ctx.get("explain_row_estimate_fail_open", False))
    try:
        estimated_rows = explain(sql)
    except Exception as exc:  # noqa: BLE001 - planner/permission errors expected here
        if fail_open:
            logger.warning("EXPLAIN failed, failing OPEN by config: %s", exc)
            return GuardrailResult(True, "explain_row_estimate")
        return GuardrailResult(
            False, "explain_row_estimate",
            "Could not verify this query's cost with EXPLAIN, so it was blocked. "
            "Simplify the query or add explicit filters.",
        )

    if estimated_rows is None:
        if fail_open:
            return GuardrailResult(True, "explain_row_estimate")
        return GuardrailResult(
            False, "explain_row_estimate",
            "EXPLAIN returned no row estimate for this query, so it was blocked.",
        )

    cap = int(ctx.get("max_scan_rows", 5_000_000))
    if estimated_rows > cap:
        return GuardrailResult(
            False, "explain_row_estimate",
            f"Planner estimates ~{int(estimated_rows):,} rows scanned (limit {cap:,}). "
            "Add filters or a LIMIT and try again.",
        )
    return GuardrailResult(True, "explain_row_estimate")


_RULES = [
    ("single_statement", rule_single_statement),
    ("syntax_valid", rule_syntax_valid),
    ("block_ddl", rule_block_ddl),
    ("block_writes", rule_block_writes),
    ("enforce_row_limit", rule_enforce_row_limit),
    ("max_subquery_depth", rule_max_subquery_depth),
    ("explain_row_estimate", rule_explain_row_estimate),
]


class GuardrailPipeline:
    def __init__(self, config=None):
        from django.conf import settings
        base = dict(getattr(settings, "GUARDRAIL_DEFAULTS", {}))
        if config:
            base.update(config)

        self._is_production = bool(getattr(settings, "IS_PRODUCTION", False))
        if self._is_production:
            forced = {k: v for k, v in _PRODUCTION_LOCKED.items() if base.get(k) != v}
            if forced:
                logger.warning(
                    "Production: ignoring guardrail config overrides for %s",
                    sorted(forced),
                )
            base.update(_PRODUCTION_LOCKED)

        self.config = base

    def check(self, sql, *, read_only=True, explain, require_explain=False):
        """Run every enabled rule in order. Returns a GuardrailReport.

        read_only:       whether the target connection forbids writes.
        explain:         REQUIRED, no default — callable(sql) -> estimated_rows,
                         or EXPLAIN_UNAVAILABLE (None) to opt out. Required so a
                         caller can't silently drop the expensive-query check.
        require_explain: when True, explain=None is a hard block. Forced True in
                         production regardless of the caller.
        """
        if self._is_production:
            require_explain = True

        normalized = _strip_comments(sql)

        if explain is None and require_explain:
            return GuardrailReport(
                passed=False,
                sql=normalized,
                blocked_rule="explain_row_estimate",
                blocked_reason=(
                    "Query-cost verification is unavailable (EXPLAIN checker not "
                    "configured). Blocked as a precaution."
                ),
            )

        ctx = dict(self.config)
        ctx["read_only"] = read_only
        ctx["explain"] = explain
        ctx["require_explain"] = require_explain

        current_sql = normalized
        warnings = []

        for name, fn in _RULES:
            if not self.config.get(name, True):
                continue
            result = fn(current_sql, ctx)
            if not result.ok:
                return GuardrailReport(
                    passed=False,
                    sql=current_sql,
                    blocked_rule=result.rule,
                    blocked_reason=result.reason,
                    warnings=warnings,
                )
            if result.rewritten_sql is not None:
                current_sql = result.rewritten_sql
            if result.reason:
                warnings.append({"rule": result.rule, "message": result.reason})

        return GuardrailReport(passed=True, sql=current_sql, warnings=warnings)
