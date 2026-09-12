from django.shortcuts import render
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from .serializers import UserSerializer, TokenUsageSerializer
from .models import PasswordResetOTP, UserTokenUsage
from django.core.mail import send_mail
from django.conf import settings
import logging

# Set up logger
logger = logging.getLogger(__name__)

# Create your views here.

class CreateUserView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]
    # Rate-limit registration (register: 5/hour). Password strength is enforced
    # by UserSerializer.validate_password.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

# Add a new view to get current user info
class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return information about the authenticated user"""
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name
        })

    def patch(self, request):
        """Update user information"""
        user = request.user

        # Update email if provided
        email = request.data.get('email')
        if email and email != user.email:
            user.email = email
            user.save()

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name
        })

# Password change views
class RequestPasswordChangeView(APIView):
    """Request a password change by sending an OTP to the user's email"""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_request"

    def post(self, request):
        user = request.user
        logger.info(f"Password change requested for user: {user.username}")

        # Check if user has an email
        if not user.email:
            logger.warning(f"User {user.username} has no email address set")
            return Response(
                {"detail": "You need to set an email address before changing your password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Generate OTP (raw code is only ever held in memory here / in the email body,
            # the stored PasswordResetOTP row only has its hash)
            otp_obj, raw_otp = PasswordResetOTP.generate_otp(user)
            logger.info(f"OTP generated successfully for user: {user.username}")

            # Send email with OTP
            subject = "Password Change Request - Your One-Time Code"
            message = f"""
Hello {user.username},

We received a password change request for your account.

Your verification code is: {raw_otp}

This code will expire in 10 minutes.

If you did not request this password change, please ignore this email.

Best regards,
The Support Team
"""

            try:
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=False,
                )

                logger.info(f"Email with OTP sent successfully to {user.email}")
                return Response(
                    {"detail": "Verification code sent to your email address. Please check your inbox and enter the code."},
                    status=status.HTTP_200_OK
                )
            except Exception:
                logger.exception(f"Failed to send OTP email for user: {user.username}")
                return Response(
                    {"detail": "Failed to send verification email. Please try again later."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception:
            logger.exception(f"Error in password change request for user: {user.username}")
            return Response(
                {"detail": "An unexpected error occurred. Please try again later."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VerifyOTPView(APIView):
    """Verify the OTP provided by the user"""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp_verify"

    def post(self, request):
        user = request.user
        otp = request.data.get('otp')

        if not otp:
            return Response(
                {"detail": "OTP is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Find the most recent valid OTP for this user
        try:
            otp_obj = PasswordResetOTP.objects.filter(
                user=user,
                is_used=False,
            ).latest('created_at')

            if not otp_obj.is_valid():
                return Response(
                    {"detail": "OTP has expired or too many attempts were made. Please request a new one."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if not otp_obj.check_otp(otp):
                return Response(
                    {"detail": "Invalid OTP. Please try again."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Mark OTP as used
            otp_obj.is_used = True
            otp_obj.save(update_fields=["is_used"])

            # Generate a temporary token to authorize the password change
            refresh = RefreshToken.for_user(user)
            refresh['password_reset'] = True

            return Response({
                "detail": "OTP verified successfully. You can now set a new password.",
                "token": str(refresh.access_token)
            })

        except PasswordResetOTP.DoesNotExist:
            return Response(
                {"detail": "No active OTP found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST
            )

class SetNewPasswordView(APIView):
    """Set a new password after OTP verification"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # This endpoint must only be reachable with the short-lived token that
        # VerifyOTPView issues (carrying a password_reset claim) — never with a
        # normal login access token, otherwise the OTP step could be bypassed entirely.
        if not request.auth or not request.auth.get('password_reset', False):
            return Response(
                {"detail": "This action requires a verified password-reset session. Please verify your OTP again."},
                status=status.HTTP_403_FORBIDDEN
            )

        new_password = request.data.get('new_password')

        if not new_password:
            return Response(
                {"detail": "New password is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password(new_password, user=user)
        except Exception as validation_error:
            return Response(
                {"detail": list(validation_error.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password
        user.set_password(new_password)
        user.save()

        # Generate new tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            "detail": "Password changed successfully.",
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        })

# Add a dedicated login endpoint that works alongside Firebase auth
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        """Handle traditional form-based login"""
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email')

        if not username or not password:
            return Response(
                {"detail": "Username and password are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Try to authenticate with Django's system
        user = authenticate(username=username, password=password)

        # If authentication failed but email was provided, try finding by email
        if not user and email:
            try:
                # Find the user by email to provide a better error message
                user_obj = User.objects.get(email=email)
                return Response(
                    {"detail": "This email was registered with Google Sign-In. Please use Google to log in."},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            except User.DoesNotExist:
                pass

        if not user:
            return Response(
                {"detail": "Invalid credentials."},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Authentication successful, generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'username': user.username,
            'email': user.email
        })

class LogoutView(APIView):
    """Blacklist the supplied refresh token so it can no longer be used to obtain new access tokens"""
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {"detail": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            # Already invalid/expired/blacklisted — logout is idempotent either way.
            pass

        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)

# Token usage endpoint
class TokenUsageView(APIView):
    """Get token usage data for the authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Return token usage data for the current user"""
        try:
            # Get query parameters for filtering
            days = request.query_params.get('days', None)
            limit = int(request.query_params.get('limit', 100))

            # Base query for current user's token usage
            queryset = UserTokenUsage.objects.filter(user=request.user)

            # Apply date filtering if requested
            if days:
                from django.utils import timezone
                import datetime
                days = int(days)
                start_date = timezone.now() - datetime.timedelta(days=days)
                queryset = queryset.filter(timestamp__gte=start_date)

            # Apply limit and order by timestamp
            queryset = queryset.order_by('-timestamp')[:limit]

            serializer = TokenUsageSerializer(queryset, many=True)

            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            logging.exception(f"Error fetching token usage: {str(e)}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
