from django.db import models
from django.conf import settings
from django.core.validators import MaxLengthValidator
from .fields import EncryptedCharField

# Database type constants
DATABASE_TYPES = [
    ('postgresql', 'PostgreSQL'),
]

# Connection status constants
CONNECTION_STATUS = [
    ('connected', 'Connected'),
    ('disconnected', 'Disconnected'),
    ('error', 'Error'),
]

class ClientDatabase(models.Model):
    """Represents a client's database connection"""
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='databases')
    database_type = models.CharField(max_length=50, choices=DATABASE_TYPES, default='postgresql')
    host = models.CharField(max_length=255)
    port = models.IntegerField(default=5432)
    database_name = models.CharField(max_length=255)
    username = models.CharField(max_length=255)
    # Encrypted at rest via Fernet (databases/fields.py). max_length bounds the
    # ciphertext (~1444 chars worst case); the validator bounds the plaintext.
    password = EncryptedCharField(max_length=1500, validators=[MaxLengthValidator(255)])
    ssl_enabled = models.BooleanField(default=False)
    ssl_ca = models.TextField(null=True, blank=True)
    ssl_cert = models.TextField(null=True, blank=True)
    ssl_key = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_metadata_update = models.DateTimeField(null=True, blank=True)
    connection_status = models.CharField(max_length=20, choices=CONNECTION_STATUS, default='disconnected')
    # App-level read-only flag — one layer of defense in depth (with the
    # SELECT-only PG role from `create_readonly_role` and execute_query's READ
    # ONLY transaction). When True (default) GuardrailPipeline blocks writes.
    read_only = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.database_type})"

class TableMetadata(models.Model):
    """Stores metadata about database tables"""
    database = models.ForeignKey(ClientDatabase, on_delete=models.CASCADE, related_name='tables')
    schema_name = models.CharField(max_length=255, default='public')
    table_name = models.CharField(max_length=255)
    table_type = models.CharField(max_length=50)  # table, view, etc.
    description = models.TextField(null=True, blank=True)
    row_count = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('database', 'schema_name', 'table_name')
    
    def __str__(self):
        return f"{self.schema_name}.{self.table_name}"

class ColumnMetadata(models.Model):
    """Stores metadata about table columns"""
    table = models.ForeignKey(TableMetadata, on_delete=models.CASCADE, related_name='columns')
    column_name = models.CharField(max_length=255)
    data_type = models.CharField(max_length=100)
    is_nullable = models.BooleanField(default=True)
    is_primary_key = models.BooleanField(default=False)
    is_foreign_key = models.BooleanField(default=False)
    description = models.TextField(null=True, blank=True)
    # Set during extraction for low-cardinality columns; sample_values then holds
    # a few distinct values to help the model pick filter literals.
    is_categorical = models.BooleanField(default=False)
    sample_values = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('table', 'column_name')
    
    def __str__(self):
        return f"{self.table.table_name}.{self.column_name}"

class RelationshipMetadata(models.Model):
    """Stores relationships between tables (foreign keys)"""
    from_column = models.ForeignKey(ColumnMetadata, on_delete=models.CASCADE, related_name='outgoing_relationships')
    to_column = models.ForeignKey(ColumnMetadata, on_delete=models.CASCADE, related_name='incoming_relationships')
    relationship_type = models.CharField(max_length=50)  # one-to-one, one-to-many, etc.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.from_column} -> {self.to_column}"

class ERDiagram(models.Model):
    """Stores ER diagram representation of a database schema"""
    database = models.OneToOneField(ClientDatabase, on_delete=models.CASCADE, related_name='er_diagram')
    diagram_data = models.JSONField(help_text="JSON representation of the ER diagram")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"ER Diagram for {self.database.name}"


class QueryExecutionLog(models.Model):
    """One row per query attempt. block_* fields are set only for 'blocked', run
    fields only for 'executed'/'failed'. Backs the audit trail, the blocked-query
    UI, and the eval guardrail metric.

    Privacy: sql / nl_question can hold user literals; when
    settings.AUDIT_LOG_STORE_SQL is False only sql_fingerprint is stored.
    sql_fingerprint is SHA-256 of the whitespace-collapsed lower-cased SQL — an
    identity for dedup, not semantic normalization.

    Always create rows via .record() (the one place store-or-fingerprint and
    field validation live), never .objects.create().
    """
    OUTCOME_BLOCKED = 'blocked'
    OUTCOME_EXECUTED = 'executed'
    OUTCOME_FAILED = 'failed'
    OUTCOME_CHOICES = [
        (OUTCOME_BLOCKED, 'Blocked by guardrail'),
        (OUTCOME_EXECUTED, 'Executed'),
        (OUTCOME_FAILED, 'Failed during execution'),
    ]

    database = models.ForeignKey(
        ClientDatabase, on_delete=models.CASCADE, related_name='query_logs',
        null=True, blank=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='query_logs',
    )
    outcome = models.CharField(max_length=16, choices=OUTCOME_CHOICES)

    nl_question = models.TextField(null=True, blank=True)
    sql = models.TextField(blank=True, help_text="Empty when AUDIT_LOG_STORE_SQL is False")
    sql_fingerprint = models.CharField(max_length=64, blank=True)

    # outcome == 'blocked' only
    blocked_rule = models.CharField(max_length=64, blank=True)
    blocked_reason = models.TextField(blank=True)

    # outcome in ('executed', 'failed') only
    row_count = models.IntegerField(null=True, blank=True)
    execution_time_ms = models.FloatField(null=True, blank=True)
    error = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['database', 'outcome', 'created_at'])]

    def __str__(self):
        return f"QueryExecutionLog({self.outcome}, db={self.database_id})"

    @staticmethod
    def _fingerprint(sql):
        import hashlib
        normalized = ' '.join((sql or '').split()).lower()
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()

    @classmethod
    def record(cls, *, outcome, sql, database=None, user=None, nl_question=None,
               blocked_rule='', blocked_reason='', row_count=None,
               execution_time_ms=None, error=None):
        """The only supported way to create a row. Enforces per-outcome field
        validity and decides once whether to persist SQL text or just the fingerprint."""
        if outcome not in {c[0] for c in cls.OUTCOME_CHOICES}:
            raise ValueError(f"Unknown outcome: {outcome!r}")

        if outcome == cls.OUTCOME_BLOCKED:
            if not blocked_rule or not blocked_reason:
                raise ValueError("blocked outcome requires blocked_rule and blocked_reason")
            if any(v is not None for v in (row_count, execution_time_ms)) or error:
                raise ValueError("blocked outcome must not carry run/error fields")
        else:  # executed / failed
            if blocked_rule or blocked_reason:
                raise ValueError(f"{outcome} outcome must not carry block_* fields")
            if outcome == cls.OUTCOME_FAILED and not error:
                raise ValueError("failed outcome requires error")
            if outcome == cls.OUTCOME_EXECUTED and error:
                raise ValueError("executed outcome must not carry error")

        from django.conf import settings as _settings
        store_sql = getattr(_settings, 'AUDIT_LOG_STORE_SQL', True)
        return cls.objects.create(
            database=database,
            user=user,
            outcome=outcome,
            nl_question=(nl_question if store_sql else None),
            sql=(sql if store_sql else ''),
            sql_fingerprint=cls._fingerprint(sql),
            blocked_rule=blocked_rule or '',
            blocked_reason=blocked_reason or '',
            row_count=row_count,
            execution_time_ms=execution_time_ms,
            error=error,
        )
