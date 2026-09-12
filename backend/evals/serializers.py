from rest_framework import serializers

from .models import EvalRun

_METRIC_FIELDS = [
    "execution_accuracy", "sql_exact_match_rate", "guardrail_block_rate",
    "guardrail_rule_accuracy", "guardrail_false_block_rate",
    "hallucination_recall", "hallucination_fpr", "unanswerable_rate",
]


class EvalRunListSerializer(serializers.ModelSerializer):
    """Summary row for the Evaluation dashboard chart. No `raw_results` — that is
    per-case detail, served only from the detail endpoint."""

    class Meta:
        model = EvalRun
        fields = [
            "id", "created_at", "notes", "retrieval_mode", "few_shot_count",
            "model_version_tag", "subset", "n_cases", *_METRIC_FIELDS,
        ]
        read_only_fields = fields


class EvalRunDetailSerializer(EvalRunListSerializer):
    class Meta(EvalRunListSerializer.Meta):
        fields = [*EvalRunListSerializer.Meta.fields, "raw_results"]
        read_only_fields = fields
