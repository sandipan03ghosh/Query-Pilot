from rest_framework import serializers
from .models import EmbeddingModelVersion, ExperimentRun, DriftMetric


class NLQuerySerializer(serializers.Serializer):
    """Input validation for the NL->SQL endpoints."""
    query = serializers.CharField(
        min_length=1, max_length=4000, trim_whitespace=True,
        error_messages={"blank": "A question is required."},
    )
    database_id = serializers.IntegerField(min_value=1)


class RunQuerySerializer(NLQuerySerializer):
    """Input for the combined /api/llm/query/ endpoint."""
    # When given and owned by the caller, the run is logged to that session's
    # history with its confidence / verification summary.
    session_id = serializers.IntegerField(min_value=1, required=False)
    # Opt in to the extra multi-query agreement check for this call.
    deep = serializers.BooleanField(required=False, default=False)


class EmbeddingModelVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmbeddingModelVersion
        fields = [
            'id', 'version_tag', 'base_model_name', 'dimension',
            'framework_versions', 'eval_metrics', 'checksum', 'is_active',
            'source_experiment', 'imported_at',
        ]
        read_only_fields = fields


class ExperimentRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExperimentRun
        fields = [
            'id', 'run_id', 'dataset_snapshot', 'hyperparameters', 'metrics',
            'colab_notebook_url', 'status', 'started_at', 'finished_at', 'imported_at',
        ]
        read_only_fields = fields


class DriftMetricSerializer(serializers.ModelSerializer):
    class Meta:
        model = DriftMetric
        fields = [
            'id', 'database', 'model_version', 'metric_type', 'value',
            'threshold_breached', 'recommendation', 'computed_at',
        ]
        read_only_fields = fields
