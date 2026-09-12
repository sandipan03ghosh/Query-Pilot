"""
run_evals — run the golden / adversarial / hallucination fixtures against a
registered sample database and record an EvalRun.

    python manage.py run_evals --database-id 3
    python manage.py run_evals --database-id 3 --full --category aggregation
    python manage.py run_evals --database-id 3 --no-cache --notes "after prompt v3"

Defaults to a 20-case smoke subset; --full runs the whole golden set. Requires
the sample DB registered as a ClientDatabase (using the read-only role from
create_readonly_role). Calls the real nl_to_sql + execute_query pipeline.
"""
import json
import os
import time

from django.core.management.base import BaseCommand, CommandError

from databases.models import ClientDatabase
from llm_agent.models import EmbeddingModelVersion
from evals import harness
from evals.models import EvalRun

_FIXTURE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "fixtures")
_SMOKE_SIZE = 20


def _load(name):
    path = os.path.join(_FIXTURE_DIR, name)
    if not os.path.isfile(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _rate(numer, denom):
    return round(numer / denom, 4) if denom else None


class Command(BaseCommand):
    help = "Run the eval fixtures against a registered sample database."

    def add_arguments(self, parser):
        parser.add_argument("--database-id", type=int, default=None)
        parser.add_argument("--database-name", default=None, help="Alternative to --database-id.")
        parser.add_argument("--full", action="store_true", help="Run the whole golden set.")
        parser.add_argument("--category", default=None)
        parser.add_argument("--ids", default=None, help="Comma-separated case ids.")
        parser.add_argument("--no-cache", action="store_true")
        parser.add_argument("--verify", action="store_true",
                            help="Also run the hallucination fixtures (Phase B).")
        parser.add_argument("--notes", default="")
        parser.add_argument("--sleep", type=float, default=0.0,
                            help="Seconds to pause between fresh (non-cached) cases.")

    def handle(self, *args, **options):
        database = self._resolve_database(options)
        model_tag = self._active_model_tag()

        golden = _load("golden.json")
        adversarial = _load("adversarial.json")
        if not golden:
            raise CommandError(f"No golden.json found in {_FIXTURE_DIR}.")

        if options["category"]:
            golden = [c for c in golden if c.get("category") == options["category"]]
        if options["ids"]:
            wanted = {i.strip() for i in options["ids"].split(",")}
            golden = [c for c in golden if c["id"] in wanted]

        subset = "custom" if (options["category"] or options["ids"]) else (
            "full" if options["full"] else "smoke"
        )
        if subset == "smoke":
            golden = golden[:_SMOKE_SIZE]

        salt = model_tag or "no-model"
        use_cache = not options["no_cache"]
        sleep = max(0.0, options["sleep"])

        self.stdout.write(f"Golden: {len(golden)}  adversarial: {len(adversarial)}  "
                          f"subset: {subset}  cache: {'on' if use_cache else 'off'}  "
                          f"model: {model_tag or '(none)'}")

        golden_rows = []
        for i, case in enumerate(golden, 1):
            row = harness.run_golden_case(case, database, salt=salt, use_cache=use_cache)
            golden_rows.append(row)
            mark = "ok" if row["execution_match"] else ("--" if row["execution_match"] is None else "XX")
            self.stdout.write(f"  [{i}/{len(golden)}] {mark} {row['id']} ({row['category']})")
            if sleep and not row["cache_hit"]:
                time.sleep(sleep)

        adv_rows = [harness.run_adversarial_case(c, database) for c in adversarial]

        halluc_rows = []
        if options["verify"]:
            halluc_cases = _load("hallucination.json")
            for c in halluc_cases:
                halluc_rows.append(
                    harness.run_hallucination_case(c, database, salt=salt, use_cache=use_cache)
                )

        metrics = self._aggregate(golden_rows, adv_rows, halluc_rows, _load("hallucination.json"))
        few_shot = max((r.get("few_shot_count", 0) for r in golden_rows), default=0)
        retrieval_modes = sorted({str(r.get("used_retrieval")) for r in golden_rows
                                  if r.get("used_retrieval") is not None})

        run = EvalRun.objects.create(
            notes=options["notes"][:255],
            retrieval_mode=",".join(retrieval_modes) or "keyword",
            few_shot_count=few_shot,
            model_version_tag=model_tag,
            subset=subset,
            n_cases=len(golden_rows),
            raw_results={"golden": golden_rows, "adversarial": adv_rows, "hallucination": halluc_rows},
            **metrics,
        )
        self._print_summary(metrics, adv_rows)
        self.stdout.write(self.style.SUCCESS(f"Saved EvalRun #{run.id}."))

    # -- helpers --------------------------------------------------------------

    def _resolve_database(self, options):
        if options["database_id"]:
            try:
                return ClientDatabase.objects.get(id=options["database_id"])
            except ClientDatabase.DoesNotExist:
                raise CommandError(f"No ClientDatabase with id {options['database_id']}.")
        if options["database_name"]:
            qs = ClientDatabase.objects.filter(name=options["database_name"])
            if qs.count() != 1:
                raise CommandError(f"Expected exactly one database named "
                                   f"{options['database_name']!r}, found {qs.count()}.")
            return qs.first()
        raise CommandError(
            "Pass --database-id or --database-name. Register the sample DB in the app "
            "first (using the read-only role from create_readonly_role)."
        )

    def _active_model_tag(self):
        # Let DB errors propagate — don't paper over a broken table during an eval.
        v = EmbeddingModelVersion.objects.filter(is_active=True).first()
        return v.version_tag if v else ""

    def _aggregate(self, golden_rows, adv_rows, halluc_rows, halluc_cases):
        scored = [r for r in golden_rows if r["execution_match"] is not None]
        matched = sum(1 for r in scored if r["execution_match"])

        exact_scored = [r for r in golden_rows if r["sql_exact_match"] is not None]
        exact = sum(1 for r in exact_scored if r["sql_exact_match"])

        unanswerable_cases = [r for r in golden_rows if r["category"] == "unanswerable"]
        unanswerable_ok = sum(1 for r in unanswerable_cases if r["execution_match"])

        # Block rate (blocked at all) vs rule accuracy (right rule, among blocked).
        blocked = [r for r in adv_rows if r["blocked"]]
        rule_ok = sum(1 for r in blocked if r["rule_ok"])

        # False blocks: golden cases that executed but were blocked.
        executed_golden = [r for r in golden_rows if r["executed"]]
        false_blocks = sum(1 for r in executed_golden if r["blocked_rule"])

        # Hallucination: recall over "bad" cases, FPR over "good" cases.
        label_by_id = {c["id"]: c.get("label") for c in halluc_cases}
        h_scored = [r for r in halluc_rows if not r.get("skipped")]
        bad = [r for r in h_scored if label_by_id.get(r["id"]) == "bad"]
        good = [r for r in h_scored if label_by_id.get(r["id"]) == "good"]
        recall = _rate(sum(1 for r in bad if r.get("flagged")), len(bad)) if bad else None
        fpr = _rate(sum(1 for r in good if r.get("flagged")), len(good)) if good else None

        return {
            "execution_accuracy": _rate(matched, len(scored)),
            "sql_exact_match_rate": _rate(exact, len(exact_scored)),
            "guardrail_block_rate": _rate(len(blocked), len(adv_rows)),
            "guardrail_rule_accuracy": _rate(rule_ok, len(blocked)),
            "guardrail_false_block_rate": _rate(false_blocks, len(executed_golden)),
            "unanswerable_rate": _rate(unanswerable_ok, len(unanswerable_cases)),
            "hallucination_recall": recall,
            "hallucination_fpr": fpr,
        }

    def _print_summary(self, m, adv_rows):
        def pct(v):
            return f"{v:.0%}" if v is not None else "n/a"
        blocked = sum(1 for r in adv_rows if r["blocked"])
        self.stdout.write("")
        self.stdout.write("=" * 46)
        self.stdout.write(f"Execution-match accuracy : {pct(m['execution_accuracy'])}")
        self.stdout.write(f"SQL exact-match rate     : {pct(m['sql_exact_match_rate'])}")
        self.stdout.write(f"Guardrail block rate     : {pct(m['guardrail_block_rate'])} "
                          f"({blocked}/{len(adv_rows)})")
        self.stdout.write(f"Guardrail rule accuracy  : {pct(m['guardrail_rule_accuracy'])}")
        self.stdout.write(f"Guardrail false blocks   : {pct(m['guardrail_false_block_rate'])}")
        self.stdout.write(f"Unanswerable handled     : {pct(m['unanswerable_rate'])}")
        self.stdout.write(f"Hallucination recall     : {pct(m['hallucination_recall'])}")
        self.stdout.write(f"Hallucination FPR        : {pct(m['hallucination_fpr'])}")
        self.stdout.write("=" * 46)
