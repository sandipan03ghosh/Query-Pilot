import os
import logging

import firebase_admin
from firebase_admin import auth as firebase_admin_auth, credentials
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
import secrets
import string

logger = logging.getLogger(__name__)


def _ensure_firebase_app():
    """Lazily initialize the Firebase Admin SDK exactly once, from a service
    account key file whose path is provided via FIREBASE_SERVICE_ACCOUNT_KEY_PATH.
    Never crashes at import time — only when this endpoint is actually used
    without the credential configured."""
    if firebase_admin._apps:
        return
    key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")
    if not key_path:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_KEY_PATH is not set — cannot verify Firebase ID tokens."
        )
    firebase_admin.initialize_app(credentials.Certificate(key_path))


class FirebaseAuthView(APIView):
    """
    Authentication view for handling both form-based Firebase login and Google sign-ins.
    This centralizes all Firebase authentication into a single endpoint.

    Security note: the caller's identity (uid/email) is never trusted from the
    request body. The client must send the Firebase ID token it obtained from
    the Firebase client SDK after sign-in; this view verifies that token
    server-side via the Firebase Admin SDK and derives uid/email only from the
    verified token payload.
    """
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        id_token = request.data.get('id_token')
        if not id_token:
            return Response(
                {"detail": "id_token is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            _ensure_firebase_app()
            decoded_token = firebase_admin_auth.verify_id_token(id_token)
        except RuntimeError:
            logger.exception("Firebase Admin SDK is not configured")
            return Response(
                {"detail": "Firebase authentication is not available right now."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except firebase_admin_auth.InvalidIdTokenError:
            return Response(
                {"detail": "Invalid or expired authentication token. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception:
            logger.exception("Unexpected error verifying Firebase ID token")
            return Response(
                {"detail": "Could not verify authentication token. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # From here on, uid/email are trusted because they came from the verified token,
        # never from the request body.
        uid = decoded_token.get('uid')
        email = decoded_token.get('email')

        if not email or not uid:
            return Response(
                {"detail": "Firebase account has no verified email on file."},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = request.data.get('username')
        display_name = request.data.get('display_name', '')
        is_google_login = bool(request.data.get('is_google_login', False))
        is_registration = bool(request.data.get('is_registration', False))
        # Only used to set the Django-side shadow password on first creation —
        # Firebase remains the actual authenticator for this account either way.
        form_password = request.data.get('password')

        # Generate a username for Google users if not provided
        if is_google_login and not username:
            username = display_name or email.split('@')[0]
            # Make username unique by removing non-alphanumeric chars and adding part of uid
            username = ''.join(c for c in username if c.isalnum())
            username = f"{username}_{uid[-6:]}"

        # Generate a strong random password for the Django user if no form password provided
        # (Firebase handles actual auth, this is just for Django's model)
        password = form_password if form_password else ''.join(
            secrets.choice(string.ascii_letters + string.digits + string.punctuation)
            for _ in range(20)
        )

        # Try to find existing user or create a new one
        try:
            # First check if user exists with this (verified) email
            user = User.objects.get(email=email)

            # If this is a registration attempt for an existing email, return an error
            if is_registration and not is_google_login:
                return Response(
                    {"detail": "This email is already registered. Please login instead."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # For existing users, we don't change their username
            # This keeps form login and Google login working for the same user

        except User.DoesNotExist:
            # User doesn't exist, create a new one
            if not username:
                return Response(
                    {"detail": "Username is required for registration"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if username is already taken
            if User.objects.filter(username=username).exists():
                return Response(
                    {"detail": "This username is already taken. Please choose a different one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create new user
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password  # Use the actual password or the generated one
            )

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        # Add username to token payload
        refresh['username'] = user.username

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'username': user.username,
            'email': user.email
        })
