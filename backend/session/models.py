from django.db import models
from django.contrib.auth.models import User

class Session(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    title = models.CharField(max_length=255, default="New Session")
    database_name = models.CharField(max_length=255, null=True, blank=True)
    database_id = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.user.username}"
    
    class Meta:
        ordering = ['-updated_at']

class Query(models.Model):
    FEEDBACK_CHOICES = [
        ('up', 'Thumbs up'),
        ('down', 'Thumbs down'),
    ]

    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='queries')
    prompt = models.TextField()
    response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=True)
    error_type = models.CharField(max_length=100, null=True, blank=True)
    error = models.TextField(null=True, blank=True)
    generated_sql = models.TextField(null=True, blank=True)
    explanation = models.TextField(null=True, blank=True)
    # Which tables/columns existed at the time this query ran, so training-data
    # export stays accurate even after the live schema later changes.
    schema_snapshot = models.JSONField(null=True, blank=True)
    # Set by the /api/llm/query/ pipeline; all nullable (older rows / raw SQL
    # editor leave them unset). Serialized to the client, so write only
    # display-safe summaries: numeric signals, short messages, pass/fail flags —
    # no raw SQL, DB traces, or EXPLAIN internals (those go to QueryExecutionLog).
    confidence_score = models.FloatField(null=True, blank=True)
    confidence_breakdown = models.JSONField(null=True, blank=True)
    guardrail_warnings = models.JSONField(null=True, blank=True)
    verification = models.JSONField(null=True, blank=True)
    # Optional user feedback on the generated SQL — a supporting signal for
    # semantic drift detection, since real "was this retrieval good" data
    # doesn't otherwise exist. Never required, never auto-populated.
    feedback = models.CharField(max_length=4, choices=FEEDBACK_CHOICES, null=True, blank=True)

    def __str__(self):
        return f"Query by {self.session.user.username} in {self.session.title}"
    
    class Meta:
        ordering = ['created_at']
        verbose_name_plural = "queries"
