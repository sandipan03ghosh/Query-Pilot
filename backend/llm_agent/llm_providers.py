"""
Provider abstraction for LLM calls. The app talks to LLMProvider, never to
google-genai / Groq directly, so adding a provider is confined to this file.

Every prompt passed to generate() leaves the app for an external vendor — prompt
builders must not include credentials, connection strings, or full row data
(sample values only when settings.LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT is True).

With `response_schema`, result["parsed"] is set only after a minimal structural
check (_matches_schema: top-level type, required keys, property types) — not full
JSON-Schema validation. Generated SQL still passes GuardrailPipeline + EXPLAIN.

generate() returns a stable shape:
    {success: bool, content: str, parsed: dict|None, token_usage: {...},
     error: str (GENERIC when success is False), error_type: str}
Raw error detail goes to the server log only. Token usage is reported, not
persisted — services.llm_api does the bookkeeping.
"""
from __future__ import annotations

import json
import logging
import os
import re
from abc import ABC, abstractmethod

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

GROQ_MODELS = {
    "llama-3.1-8b-instant", "llama-3.1-70b-versatile", "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768", "gemma2-9b-it", "deepseek-r1-distill-llama-70b",
}
GROQ_DEFAULT_MODEL = "llama-3.1-8b-instant"

_GENERIC_ERROR = "The language model request could not be completed."


def _empty_usage(model):
    return {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "model": model}


def _salvage_json(text):
    """Best-effort JSON extraction from prose / ```json fences. Permissive — the
    result is only trusted after _matches_schema()."""
    if not text:
        return None
    text = text.strip()
    if "```" in text:
        m = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
        if m:
            text = m.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start, end = text.find("{"), text.rfind("}")
    if 0 <= start < end:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            return None
    return None


_JSON_TYPE_TO_PY = {
    "object": dict, "array": list, "string": str,
    "number": (int, float), "integer": int, "boolean": bool,
}


def _matches_schema(obj, schema):
    """Minimal structural check (not a JSON-Schema validator): top-level type,
    required keys present, declared property types. The real safety net for
    generated SQL is the guardrail pipeline + EXPLAIN."""
    if not isinstance(schema, dict):
        return True
    expected = _JSON_TYPE_TO_PY.get(schema.get("type"))
    if expected and not isinstance(obj, expected):
        return False
    if schema.get("type") == "object" or isinstance(obj, dict):
        if not isinstance(obj, dict):
            return False
        for key in schema.get("required", []):
            if key not in obj:
                return False
        for key, subschema in (schema.get("properties") or {}).items():
            if key in obj and not _matches_schema(obj[key], subschema):
                return False
    return True


class LLMProvider(ABC):
    def __init__(self, model):
        self.model = model

    @abstractmethod
    def generate(self, prompt, *, response_schema=None, temperature=0.0, max_tokens=1024):
        ...

    def _finish_structured(self, content, response_schema, candidate):
        """Accept candidate (or a salvaged object) only if it matches the schema."""
        if response_schema is None:
            return None
        obj = candidate if candidate is not None else _salvage_json(content)
        if obj is not None and _matches_schema(obj, response_schema):
            return obj
        if obj is not None:
            logger.warning("LLM returned JSON that does not match the expected schema.")
        return None


class GeminiProvider(LLMProvider):
    """The only place google-genai is imported."""

    def __init__(self, api_key, model):
        super().__init__(model)
        self._api_key = api_key

    def generate(self, prompt, *, response_schema=None, temperature=0.0, max_tokens=1024):
        try:
            from google import genai
            from google.genai import types as genai_types

            client = genai.Client(api_key=self._api_key)
            config_kwargs = {"temperature": temperature, "max_output_tokens": max_tokens}
            if response_schema is not None:
                config_kwargs["response_mime_type"] = "application/json"
                config_kwargs["response_schema"] = response_schema

            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(**config_kwargs),
            )
            content = response.text or ""
            usage = getattr(response, "usage_metadata", None)
            token_usage = {
                "prompt_tokens": getattr(usage, "prompt_token_count", 0) or 0,
                "completion_tokens": getattr(usage, "candidates_token_count", 0) or 0,
                "total_tokens": getattr(usage, "total_token_count", 0) or 0,
                "model": self.model,
            }
            parsed = self._finish_structured(
                content, response_schema, getattr(response, "parsed", None),
            )
            return {"success": True, "content": content, "parsed": parsed,
                    "token_usage": token_usage}
        except Exception:  # noqa: BLE001
            logger.exception("Gemini generate() failed")
            return {
                "success": False, "content": "", "parsed": None,
                "token_usage": _empty_usage(self.model),
                "error": _GENERIC_ERROR, "error_type": "gemini_error",
            }


class GroqProvider(LLMProvider):
    ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key, model):
        super().__init__(model if model in GROQ_MODELS else GROQ_DEFAULT_MODEL)
        self._api_key = api_key

    def generate(self, prompt, *, response_schema=None, temperature=0.0, max_tokens=1024):
        content_text = prompt
        data = {"model": self.model, "temperature": temperature, "max_tokens": max_tokens}
        if response_schema is not None:
            data["response_format"] = {"type": "json_object"}
            content_text = (
                prompt
                + "\n\nReturn ONLY a JSON object matching this JSON schema "
                  "(no prose, no code fences):\n"
                + json.dumps(response_schema)
            )
        data["messages"] = [{"role": "user", "content": content_text}]
        try:
            resp = requests.post(
                self.ENDPOINT,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json=data,
                timeout=30,
            )
            resp.raise_for_status()
            body = resp.json()
            content = body["choices"][0]["message"]["content"]
            content = content.split("</think>")[-1].strip()
            usage = body.get("usage", {})
            token_usage = {
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
                "model": self.model,
            }
            parsed = self._finish_structured(content, response_schema, None)
            return {"success": True, "content": content, "parsed": parsed,
                    "token_usage": token_usage}
        except requests.exceptions.RequestException as e:
            logger.error("Groq request failed: %s", e)
            return {
                "success": False, "content": "", "parsed": None,
                "token_usage": _empty_usage(self.model),
                "error": _GENERIC_ERROR, "error_type": "api_connection_error",
            }
        except (KeyError, ValueError) as e:
            logger.error("Groq response parse failed: %s", e)
            return {
                "success": False, "content": "", "parsed": None,
                "token_usage": _empty_usage(self.model),
                "error": _GENERIC_ERROR, "error_type": "groq_error",
            }


def get_provider(model=None):
    """Resolve (provider, model) from configured keys. If the requested provider
    has no key, raise — unless settings.LLM_ALLOW_PROVIDER_FALLBACK, then fall
    back to the other vendor (logged loudly)."""
    model = model or getattr(settings, "SQL_GENERATION_MODEL", "gemini-2.0-flash")
    gemini_key = os.getenv("GEMINI_API_KEY") or getattr(settings, "GEMINI_API_KEY", None)
    groq_key = os.getenv("GROQ_API_KEY")
    allow_fallback = bool(getattr(settings, "LLM_ALLOW_PROVIDER_FALLBACK", False))

    wants_gemini = model.startswith("gemini")

    if wants_gemini:
        if gemini_key:
            return GeminiProvider(gemini_key, model), model
        if allow_fallback and groq_key:
            logger.warning(
                "Gemini requested but no GEMINI_API_KEY — FALLING BACK to Groq. "
                "Prompts will be sent to Groq instead."
            )
            return GroqProvider(groq_key, GROQ_DEFAULT_MODEL), GROQ_DEFAULT_MODEL
        raise RuntimeError("Gemini model requested but GEMINI_API_KEY is not set.")

    if groq_key:
        groq_model = model if model in GROQ_MODELS else GROQ_DEFAULT_MODEL
        return GroqProvider(groq_key, groq_model), groq_model
    if allow_fallback and gemini_key:
        logger.warning(
            "Non-Gemini model requested but no GROQ_API_KEY — FALLING BACK to Gemini."
        )
        return GeminiProvider(gemini_key, "gemini-2.0-flash"), "gemini-2.0-flash"
    raise RuntimeError("No LLM provider configured: set GEMINI_API_KEY or GROQ_API_KEY.")
