from django.db import models
from django.db.models import Q, UniqueConstraint


class ExperimentRun(models.Model):
    """
    A record of one Colab fine-tuning run. Always created after the fact via
    `import_experiment_run` — this app never runs training itself.
    """
    STATUS_CHOICES = [
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    run_id = models.CharField(max_length=100, unique=True, help_text="Identifier assigned by the Colab notebook, not this DB")
    dataset_snapshot = models.ForeignKey(
        'TrainingDataSnapshot', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='experiment_runs',
    )
    hyperparameters = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    colab_notebook_url = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-imported_at']

    def __str__(self):
        return f"ExperimentRun({self.run_id}, {self.status})"


class TrainingDataSnapshot(models.Model):
    """Audits exactly what data went into a given `export_training_data` run."""
    export_path = models.CharField(max_length=500)
    row_count = models.IntegerField()
    # Null when the export is purely schema-derived bootstrap pairs with no
    # real query history behind them yet.
    date_range_start = models.DateTimeField(null=True, blank=True)
    date_range_end = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"TrainingDataSnapshot({self.export_path}, {self.row_count} rows)"


class EmbeddingModelVersion(models.Model):
    """
    One imported, validated Colab-trained embedding model. Never created
    directly — only via `import_model_version`, which must pass every
    artifact_validator check first. `is_active` is DB-enforced to be unique
    (at most one active version at a time) so retrieval can never end up
    reading from two inconsistent vector spaces at once.
    """
    version_tag = models.CharField(max_length=100, unique=True, help_text='e.g. "v3_2026-07-28"')
    model_path = models.CharField(max_length=500, help_text="Filesystem path to the model directory")
    base_model_name = models.CharField(max_length=255, help_text='e.g. "sentence-transformers/all-MiniLM-L6-v2"')
    dimension = models.IntegerField()
    # Framework/library versions pinned at training time (Python, torch,
    # sentence-transformers, transformers) — copied from the artifact's
    # manifest.json, compared against installed versions at import time.
    framework_versions = models.JSONField(default=dict, blank=True)
    eval_metrics = models.JSONField(default=dict, blank=True, help_text="Precision@k / Recall@k / MRR from the Colab eval notebook")
    checksum = models.CharField(max_length=64, help_text="SHA-256 hex digest of the model weights file")
    is_active = models.BooleanField(default=False)
    source_experiment = models.ForeignKey(
        ExperimentRun, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='model_versions',
    )
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-imported_at']
        constraints = [
            UniqueConstraint(
                fields=['is_active'],
                condition=Q(is_active=True),
                name='only_one_active_embedding_model_version',
            ),
        ]

    def __str__(self):
        return f"EmbeddingModelVersion({self.version_tag}, active={self.is_active})"


class Embedding(models.Model):
    """
    Metadata for one embedded schema element — the vector itself lives only
    in the FAISS index for (database, model_version); this row is what
    connects a FAISS row ID back to a real TableMetadata/ColumnMetadata and
    tells you which model produced it. `id` on this row is the same integer
    used as the vector's ID inside the FAISS IndexIDMap, so a FAISS search
    result maps straight back to this table with no separate position field.
    """
    OWNER_TYPE_CHOICES = [
        ('table', 'Table'),
        ('column', 'Column'),
    ]

    database = models.ForeignKey('databases.ClientDatabase', on_delete=models.CASCADE, related_name='embeddings')
    owner_type = models.CharField(max_length=10, choices=OWNER_TYPE_CHOICES)
    owner_id = models.IntegerField(help_text="PK of the TableMetadata or ColumnMetadata row, per owner_type")
    model_version = models.ForeignKey(EmbeddingModelVersion, on_delete=models.CASCADE, related_name='embeddings')
    dimension = models.IntegerField()
    checksum = models.CharField(max_length=64, blank=True, help_text="Optional hash of the source text that was embedded, for change detection")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=['owner_type', 'owner_id', 'model_version'],
                name='unique_embedding_per_owner_per_model_version',
            ),
        ]
        indexes = [
            models.Index(fields=['database', 'model_version']),
        ]

    def __str__(self):
        return f"Embedding({self.owner_type}#{self.owner_id}, {self.model_version.version_tag})"


class DriftMetric(models.Model):
    """
    A single drift-related measurement for a database. Purely observational —
    `recommendation` is advisory text for a human to read; nothing in this
    app ever acts on it automatically.
    """
    database = models.ForeignKey('databases.ClientDatabase', on_delete=models.CASCADE, related_name='drift_metrics')
    model_version = models.ForeignKey(
        EmbeddingModelVersion, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='drift_metrics',
    )
    metric_type = models.CharField(max_length=50, help_text='e.g. "query_success_rate", "schema_change_volume"')
    value = models.FloatField()
    threshold_breached = models.BooleanField(default=False)
    recommendation = models.TextField(blank=True, help_text="Advisory only — never acted on automatically")
    computed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-computed_at']

    def __str__(self):
        return f"DriftMetric({self.metric_type}={self.value}, db={self.database_id})"


class SemanticRelationship(models.Model):
    """
    A similarity-based edge between two schema elements, computed from a
    specific model version's embeddings — complements the structural
    (FK-based) ER diagram with a learned-similarity graph.
    """
    NODE_TYPE_CHOICES = [
        ('table', 'Table'),
        ('column', 'Column'),
    ]

    database = models.ForeignKey('databases.ClientDatabase', on_delete=models.CASCADE, related_name='semantic_relationships')
    from_type = models.CharField(max_length=10, choices=NODE_TYPE_CHOICES)
    from_id = models.IntegerField()
    to_type = models.CharField(max_length=10, choices=NODE_TYPE_CHOICES)
    to_id = models.IntegerField()
    similarity_score = models.FloatField()
    model_version = models.ForeignKey(EmbeddingModelVersion, on_delete=models.CASCADE, related_name='semantic_relationships')
    computed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=['database', 'from_type', 'from_id', 'to_type', 'to_id', 'model_version'],
                name='unique_semantic_relationship_per_model_version',
            ),
        ]
        indexes = [
            models.Index(fields=['database', 'model_version']),
        ]

    def __str__(self):
        return f"SemanticRelationship({self.from_type}#{self.from_id} -> {self.to_type}#{self.to_id}, {self.similarity_score:.3f})"
