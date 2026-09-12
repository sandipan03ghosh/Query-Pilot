from rest_framework import serializers
from .models import Session, Query

class QuerySerializer(serializers.ModelSerializer):
    # Access control is in the views, not here: session/views.py resolves rows
    # via Session.objects.get(..., user=request.user). Never use this serializer
    # on a queryset not already scoped to the owner.
    # prompt / generated_sql / explanation / error may hold literals -> owner-only.
    # confidence_* / guardrail_warnings / verification are display-safe by
    # construction (see the Query model docstring).
    class Meta:
        model = Query
        fields = [
            'id', 'prompt', 'response', 'created_at', 'success', 'error_type',
            'error', 'generated_sql', 'explanation', 'feedback',
            'confidence_score', 'confidence_breakdown', 'guardrail_warnings',
            'verification',
        ]


class SessionSerializer(serializers.ModelSerializer):
    queries = QuerySerializer(many=True, read_only=True)
    query_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Session
        fields = ['id', 'title', 'database_name', 'database_id', 'created_at', 'updated_at', 'queries', 'query_count']
        
    def get_query_count(self, obj):
        return obj.queries.count()


class SessionListSerializer(serializers.ModelSerializer):
    query_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Session
        fields = ['id', 'title', 'database_name', 'database_id', 'created_at', 'updated_at', 'query_count']
        
    def get_query_count(self, obj):
        return obj.queries.count()
