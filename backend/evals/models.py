from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

_RATE = [MinValueValidator(0.0), MaxValueValidator(1.0)]


class EvalRun(models.Model):
    """One execution of `run_evals`.

    All *_rate / *_accuracy / *_recall / *_fpr fields are fractions in [0, 1];
    validators aren't DB-enforced, so save() calls full_clean() on every write.

    raw_results CONTRACT — per case, only non-sensitive fields: id, category,
    pass/fail flags, error_type strings, timings. No generated/gold SQL, result
    rows, or question text. APIs exposing EvalRun still require auth.
    """
    created_at = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=255, blank=True)

    retrieval_mode = models.CharField(
        max_length=64, blank=True,
        help_text="Observed schema-retrieval path(s), comma-joined: vector / keyword / full.",
    )
    few_shot_count = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    model_version_tag = models.CharField(max_length=100, blank=True)
    subset = models.CharField(max_length=16, default="smoke", help_text="smoke / full / custom")

    n_cases = models.IntegerField(default=0, validators=[MinValueValidator(0)])
    execution_accuracy = models.FloatField(null=True, blank=True, validators=_RATE)
    sql_exact_match_rate = models.FloatField(null=True, blank=True, validators=_RATE)
    # block_rate: adversarial inputs blocked at all. rule_accuracy: of those,
    # fraction where the expected rule fired.
    guardrail_block_rate = models.FloatField(null=True, blank=True, validators=_RATE)
    guardrail_rule_accuracy = models.FloatField(null=True, blank=True, validators=_RATE)
    # false_block_rate: golden cases that produced SQL but were then blocked.
    guardrail_false_block_rate = models.FloatField(null=True, blank=True, validators=_RATE)
    hallucination_recall = models.FloatField(null=True, blank=True, validators=_RATE)
    hallucination_fpr = models.FloatField(null=True, blank=True, validators=_RATE)
    unanswerable_rate = models.FloatField(null=True, blank=True, validators=_RATE)

    raw_results = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        # Rate-bound validators are not DB-enforced.
        self.full_clean(exclude=["created_at"])
        super().save(*args, **kwargs)

    def __str__(self):
        acc = f"{self.execution_accuracy:.0%}" if self.execution_accuracy is not None else "n/a"
        return f"EvalRun({self.created_at:%Y-%m-%d %H:%M}, exec_acc={acc})"
