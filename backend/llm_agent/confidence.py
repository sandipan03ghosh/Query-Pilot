"""
Confidence scoring for a generated-and-executed query.

compose(signals) -> {"score": 0-100, "breakdown": {...}, "flags": [...]}

Each signal is a float in [0, 1] or None (did not run). Weights come from
settings.CONFIDENCE_WEIGHTS; signals that did not run are dropped and the
remaining weights renormalised, so a missing signal never silently drags the
score toward zero.

The output is display-safe by construction: numbers, short strings, booleans.
It carries no SQL, rows, or DB detail — it is written onto session.Query and
returned to the client.
"""
from __future__ import annotations

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_DEFAULT_WEIGHTS = {
    "syntax_valid": 0.15,
    "back_translation": 0.35,
    "sanity_checks": 0.20,
    "multi_query_agreement": 0.15,
    "schema_coverage": 0.15,
}

_LABELS = {
    "syntax_valid": "SQL parses",
    "back_translation": "Question round-trips",
    "sanity_checks": "Result sanity checks",
    "multi_query_agreement": "Second query agrees",
    "schema_coverage": "Uses retrieved tables",
}

# Below this composite score the query is surfaced as low-confidence in the UI.
LOW_CONFIDENCE_SCORE = 55


def _weights():
    """Known signal weights, sanitised. A configured entry is used only if it is
    a finite, non-negative number for a signal name we recognise; anything else
    falls back to the default for that name. If the result is all-zero the
    defaults are used, so a broken CONFIDENCE_WEIGHTS can't wipe out scoring."""
    configured = getattr(settings, "CONFIDENCE_WEIGHTS", None)
    configured = configured if isinstance(configured, dict) else {}

    out = {}
    for name, default in _DEFAULT_WEIGHTS.items():
        weight = default
        if name in configured:
            raw = configured[name]
            try:
                candidate = float(raw)
            except (TypeError, ValueError):
                candidate = None
            if candidate is None or candidate != candidate or candidate == float("inf") or candidate < 0:
                logger.warning("Ignoring invalid CONFIDENCE_WEIGHTS[%r]=%r", name, raw)
            else:
                weight = candidate
        out[name] = weight

    if sum(out.values()) <= 0:
        logger.warning("CONFIDENCE_WEIGHTS summed to <= 0 — using defaults.")
        return dict(_DEFAULT_WEIGHTS)
    return out


def _clamp01(x):
    try:
        value = float(x)
    except (TypeError, ValueError):
        return None
    if value != value:   # NaN
        return None
    return max(0.0, min(1.0, value))


def compose(signals):
    """`signals`: {name: float|None}. Returns the confidence dict."""
    weights = _weights()
    signals = signals if isinstance(signals, dict) else {}

    present = {}
    for name, weight in weights.items():
        value = _clamp01(signals.get(name))
        if value is not None and weight > 0:
            present[name] = (value, weight)

    breakdown = {}
    for name in weights:
        breakdown[name] = {
            "label": _LABELS.get(name, name),
            "value": _clamp01(signals.get(name)),   # None when the signal didn't run
            "weight": round(weights[name], 3),
            "used": name in present,
        }

    if not present:
        return {"score": None, "breakdown": breakdown, "flags": ["no_confidence_signals"]}

    total_weight = sum(w for _v, w in present.values())
    weighted = sum(v * w for v, w in present.values()) / total_weight
    score = int(round(weighted * 100))

    flags = []
    if score < LOW_CONFIDENCE_SCORE:
        flags.append("low_confidence")
    bt = breakdown.get("back_translation", {}).get("value")
    threshold = float(getattr(settings, "BACK_TRANSLATION_FLAG_THRESHOLD", 0.55))
    if bt is not None and bt < threshold:
        flags.append("weak_back_translation")
    sc = breakdown.get("sanity_checks", {}).get("value")
    if sc is not None and sc < 1.0:
        flags.append("sanity_check_warnings")
    mqa = breakdown.get("multi_query_agreement", {})
    if mqa.get("used") and (mqa.get("value") or 0) < 0.5:
        flags.append("multi_query_disagreement")

    return {"score": score, "breakdown": breakdown, "flags": flags}
