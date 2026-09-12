from rest_framework import serializers
from .models import ClientDatabase, TableMetadata, ColumnMetadata, RelationshipMetadata

class ClientDatabaseSerializer(serializers.ModelSerializer):
    owner = serializers.PrimaryKeyRelatedField(read_only=True)
    # password / ssl_key are write-only; these flags tell the UI a value is set
    # without exposing it.
    password_configured = serializers.SerializerMethodField()
    ssl_key_configured = serializers.SerializerMethodField()

    class Meta:
        model = ClientDatabase
        fields = [
            'id', 'name', 'description', 'owner', 'database_type',
            'host', 'port', 'database_name', 'username', 'password',
            'ssl_enabled', 'ssl_ca', 'ssl_cert', 'ssl_key',
            'created_at', 'updated_at', 'last_metadata_update',
            'connection_status', 'read_only',
            'password_configured', 'ssl_key_configured',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_metadata_update', 'connection_status']
        extra_kwargs = {
            'password': {'write_only': True},
            'ssl_key': {'write_only': True},
        }

    def get_password_configured(self, obj):
        return bool(obj.password)

    def get_ssl_key_configured(self, obj):
        return bool(obj.ssl_key)

class QueryExecutionSerializer(serializers.Serializer):
    query = serializers.CharField(required=True)
    params = serializers.JSONField(required=False, allow_null=True)

class ConnectionTestSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    message = serializers.CharField()

class QueryResultSerializer(serializers.Serializer):
    """Output shape of DatabaseConnector.execute_query; all fields optional so it
    covers the executed / blocked / failed paths.

    Access control: `rows` and `explain_plan` are only produced for the caller's
    own database — the view must resolve it via an owner-scoped queryset.
    `explain_plan` is also suppressed by the view unless EXPOSE_EXPLAIN_PLAN.
    """
    columns = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    rows = serializers.ListField(required=False, default=list)
    status = serializers.CharField(required=False, allow_blank=True, default="")
    success = serializers.BooleanField(required=False, default=False)
    execution_time = serializers.FloatField(required=False, allow_null=True)
    error_type = serializers.CharField(required=False, allow_blank=True)
    blocked_rule = serializers.CharField(required=False, allow_blank=True)
    guardrail_warnings = serializers.ListField(required=False, default=list)
    explain_plan = serializers.JSONField(required=False, allow_null=True)
    scan_row_estimate = serializers.FloatField(required=False, allow_null=True)
    plan_total_cost = serializers.FloatField(required=False, allow_null=True)
