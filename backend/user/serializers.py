from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import UserTokenUsage


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "password", "email"]
        extra_kwargs = {"password": {"write_only": True}}

    def validate_password(self, value):
        # Django's create_user() does not run AUTH_PASSWORD_VALIDATORS itself,
        # so it must be invoked explicitly here.
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class TokenUsageSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    
    class Meta:
        model = UserTokenUsage
        fields = ['id', 'username', 'prompt_tokens', 'completion_tokens', 
                  'total_tokens', 'model', 'timestamp', 'query_text']
        
    def get_username(self, obj):
        return obj.user.username if obj.user else None
