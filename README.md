# Text-to-SQL with Guardrails, Hallucination Detection & Retrieval-Augmented Schema Selection

A natural-language-to-SQL interface for PostgreSQL with a trust layer: every
generated query passes a configurable guardrail pipeline, executes in a
sandboxed read-only transaction, and is scored for confidence with a
back-translation / result-sanity / multi-query hallucination check. A JSON eval
suite turns all of that into numbers.

> Run `python manage.py run_evals --database-id <id>` after setup to produce the
> current execution accuracy, guardrail block rate, and hallucination recall for
> your environment. Numbers depend on the LLM and the sample data; the suite is
> the source of truth, not this README.

## What makes it more than a prompt wrapper

| Layer | What it does |
|---|---|
| **Retrieval-augmented schema** | Large schemas are filtered to the tables relevant to the question — keyword ranking by default (no ML deps), or a frozen `all-MiniLM-L6-v2` + FAISS if a model is activated. FK neighbours are pulled in; the subset is hard-capped. |
| **Structured generation** | Gemini (Groq fallback) with a JSON response schema — `is_answerable`, `is_ambiguous` + `interpretations`, `sql`, `tables_used`. Ambiguous questions return clarification options instead of a guess; unanswerable ones say so. |
| **Guardrail pipeline** (`databases/guardrails.py`) | Ordered, individually-toggleable rules: single statement, DDL blocklist, write blocklist, `LIMIT` injection, subquery-depth cap, and a fail-closed `EXPLAIN` scan-row estimate. Production locks the safety-critical rules on. |
| **Sandboxed execution** | Connections for query execution use a dedicated `SELECT`-only PostgreSQL role, a libpq `READ ONLY` session, and a transaction that is always rolled back — three independent layers. |
| **Hallucination detection** (`llm_agent/verification.py`) | Back-translation alignment (embedding cosine or token overlap), result sanity checks (empty aggregates, all-NULL columns, negative counts), schema-coverage, and optional multi-query agreement. Blended into a 0–100 confidence score. |
| **Feedback flywheel** | 👍 on an answer promotes `(question, SQL)` into a per-database few-shot store (`promote_feedback`); 👎 / failures go to a review queue. The eval suite measures whether accuracy improves. |
| **Eval suite** (`evals/`) | `golden.json` / `adversarial.json` / `hallucination.json` fixtures, a result-set comparator (column-order-preserving, decimal-safe), an on-disk generation cache, and `run_evals` which records an `EvalRun` and prints a metrics table. |

## Stack

React + Vite + MUI · Django + DRF · PostgreSQL · Gemini / Groq · FAISS
(optional) · JWT auth (Firebase optional — native email/password fallback for
local dev).

## Quickstart (no Firebase, no Docker)

```bash
# --- backend ---
cd backend
python -m venv venv && venv\Scripts\activate      # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                              # fill SECRET_KEY, FIELD_ENCRYPTION_KEY,
                                                    # GEMINI_API_KEY, SAMPLE_DB_URL
python manage.py makemigrations databases session evals
python manage.py migrate

# sample database (a self-contained ~8-table media store, seeded into schema t2s_sample)
python manage.py seed_sample_db
python manage.py create_readonly_role               # prompts for a password (never echoed);
                                                    # prints host/port/db/username only
python manage.py create_dev_user --email dev@example.com

python manage.py runserver

# --- frontend ---
cd ../frontend
npm install
copy .env.example .env                              # leave VITE_FIREBASE_* unset for native auth
npm run dev
```

> **`create_readonly_role` output is for local setup.** It asks for the role
> password at an interactive prompt (not a CLI flag, not echoed) and prints only
> host / port / database / username — never the password and never a connection
> URL containing one. Don't run it in CI or paste its output anywhere; type the
> password you chose into **Add Database** yourself.

Then in the app: sign in with the dev user → **Add Database** using the
`text2sql_ro` host/port/db/username → enter the password you chose → **Extract
Schema** → start asking questions.

### Run the evals

```bash
python manage.py run_evals --database-id <id>              # 20-case smoke subset
python manage.py run_evals --database-id <id> --full --verify   # full set + hallucination checks
```

Results land on the **Evaluation** page (nav bar) and as an `EvalRun` row.

## Environment flags worth knowing

| Flag | Default | Notes |
|---|---|---|
| `DJANGO_ENV` | `development` | `production` refuses to start with `DEBUG=True` and locks the guardrails. |
| `DEV_AUTH_BYPASS` | `False` | Enables the native login form + `create_dev_user`. Dev only. |
| `LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT` | `False` | Sends real column values to the LLM. Keep off outside the synthetic sample DB. |
| `LLM_ALLOW_PROVIDER_FALLBACK` | `False` | Off ⇒ a missing API key raises instead of silently switching vendor. |
| `AUDIT_LOG_STORE_SQL` | `False` in prod | When off, `QueryExecutionLog` stores only a SHA-256 fingerprint. |
| `EXPOSE_EXPLAIN_PLAN` | `False` in prod | Whether the raw `EXPLAIN` JSON is returned to the client. |
| `VERIFICATION_MULTI_QUERY` | `False` | The extra multi-query agreement check (one more generation + execution per request). |

## Project structure

```
backend/
  databases/    connections, schema extraction, guardrails.py, sandboxed execute_query, QueryExecutionLog
  llm_agent/    llm_providers.py, prompts.py, verification.py, confidence.py, semantic/ (retrieval), run_query view
  evals/        models (EvalRun), comparators.py, harness.py, fixtures/, run_evals command
  session/      chat sessions, Query rows (confidence/verification summaries), promote_feedback command
  user/         JWT + optional Firebase auth
frontend/src/
  pages/Home.jsx             the query flow (runQuery -> confidence badge + clarification)
  pages/ModelMonitoring.jsx  Evaluation dashboard (accuracy trend + run table) + model/drift tabs
  components/ConfidenceBadge.jsx
```

## Security notes

- The `SELECT`-only role is the real boundary; the app `read_only` flag and the
  guardrail pipeline are defense-in-depth, not a substitute.
- All schema/description/few-shot/sample text is treated as untrusted in prompts
  (DATA fences + sanitisation); generated SQL always passes the guardrails +
  `EXPLAIN` before it can run.
- `localStorage` JWTs are XSS-exposed — moving to `HttpOnly` cookies is the
  outstanding production hardening item.

## License

MIT — see LICENSE.
