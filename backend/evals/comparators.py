"""
Comparators for the eval harness.

result_sets_match (headline metric) compares two execute_query results by
canonicalised rows, so different SQL returning the same answer both count:
  - column order preserved (gold defines it); column-count mismatch = mismatch.
  - row order normalised away unless ordered=True.
  - numbers compared as fixed-precision decimals (no float drift; a number never
    equals a same-digit string).

sql_normalized_match is an informational SQL-text match; low values are normal.
"""
from __future__ import annotations

import datetime
import decimal
import hashlib
import json

import sqlparse

_NUM_QUANT = decimal.Decimal("1.000000")  # 6 decimal places


def _canon_value(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return ("bool", v)
    if isinstance(v, (int, float, decimal.Decimal)):
        try:
            d = decimal.Decimal(str(v)).quantize(_NUM_QUANT, rounding=decimal.ROUND_HALF_EVEN)
            return ("num", str(d))
        except (decimal.InvalidOperation, ValueError):
            return ("str", str(v))
    if isinstance(v, (datetime.datetime, datetime.date, datetime.time)):
        return ("dt", v.isoformat())
    if isinstance(v, (bytes, bytearray, memoryview)):
        return ("bytes", bytes(v).hex())
    return ("str", str(v))


def _canon_rows(result, *, ordered):
    rows = result.get("rows") or []
    canon = [tuple(_canon_value(x) for x in row) for row in rows]  # column order kept
    if not ordered:
        canon = sorted(canon, key=repr)
    return canon


def result_sets_match(got, gold, *, ordered=False):
    """True if `got` is the same answer as `gold`. A failed/blocked side never
    matches (a failed gold is a broken query — surfaced separately)."""
    if not got.get("success") or not gold.get("success"):
        return False

    got_cols = got.get("columns") or []
    gold_cols = gold.get("columns") or []
    if len(got_cols) != len(gold_cols):
        return False

    got_c = _canon_rows(got, ordered=ordered)
    gold_c = _canon_rows(gold, ordered=ordered)
    if any(len(r) != len(gold_cols) for r in got_c):
        return False
    return got_c == gold_c


def result_fingerprint(result):
    """Short stable hash of canonical unordered rows — for logging/dedup, not comparison."""
    canon = _canon_rows(result, ordered=False)
    return hashlib.sha256(json.dumps(canon, default=str).encode("utf-8")).hexdigest()[:16]


def sql_normalized_match(a, b):
    def norm(s):
        return sqlparse.format(
            (s or "").strip().rstrip(";"),
            keyword_case="lower", identifier_case="lower",
            strip_comments=True, reindent=True,
        ).strip()
    return norm(a) == norm(b)
