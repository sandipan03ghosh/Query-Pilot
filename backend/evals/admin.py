from django.contrib import admin

from .models import EvalRun


@admin.register(EvalRun)
class EvalRunAdmin(admin.ModelAdmin):
    list_display = (
        "id", "created_at", "subset", "retrieval_mode", "few_shot_count",
        "model_version_tag", "n_cases", "execution_accuracy",
        "guardrail_block_rate", "hallucination_recall",
    )
    list_filter = ("subset", "retrieval_mode", "model_version_tag")
    readonly_fields = [f.name for f in EvalRun._meta.fields] + ["raw_results"]
    ordering = ("-created_at",)

    def has_add_permission(self, request):
        return False  # created only by the run_evals command

    def has_change_permission(self, request, obj=None):
        return False
