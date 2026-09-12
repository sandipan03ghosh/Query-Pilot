from django.db import models
from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
import secrets
import logging

# Set up logger
logger = logging.getLogger(__name__)

# Create your models here.
class PasswordResetOTP(models.Model):
    MAX_ATTEMPTS = 5

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    otp_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.IntegerField(default=0)

    def __str__(self):
        return f"OTP for {self.user.username}"

    def is_valid(self):
        """Check if the OTP is still usable (unused, unexpired, attempts remaining)"""
        return (
            not self.is_used
            and self.expires_at > timezone.now()
            and self.attempts < self.MAX_ATTEMPTS
        )

    def check_otp(self, raw_otp):
        """
        Verify a submitted code against the stored hash.

        Self-contained: re-checks used/expiry/attempt state independently of
        whether the caller already called is_valid(), and increments the
        attempt counter via an atomic conditional UPDATE (attempts__lt=MAX_ATTEMPTS)
        so concurrent verification requests can't collectively exceed MAX_ATTEMPTS.
        """
        if not self.is_valid():
            return False

        updated = PasswordResetOTP.objects.filter(
            pk=self.pk, attempts__lt=self.MAX_ATTEMPTS
        ).update(attempts=F("attempts") + 1)
        if not updated:
            # A concurrent request already used up the last remaining attempt.
            return False

        self.refresh_from_db(fields=["attempts"])
        return check_password(raw_otp, self.otp_hash)

    @classmethod
    def generate_otp(cls, user, expiry_minutes=10):
        """Generate a new OTP for the given user. Returns (otp_obj, raw_otp) —
        the raw code is never persisted, only its hash is stored on otp_obj."""
        logger.info(f"Invalidating previous OTPs for user {user.username}")
        # Invalidate any existing OTPs
        cls.objects.filter(user=user, is_used=False).update(is_used=True)

        # Generate a 6-digit OTP using a CSPRNG, store only its hash
        otp = f"{secrets.randbelow(1_000_000):06d}"
        expires_at = timezone.now() + timezone.timedelta(minutes=expiry_minutes)

        otp_obj = cls.objects.create(
            user=user,
            otp_hash=make_password(otp),
            expires_at=expires_at,
        )
        logger.info(f"Created OTP object with ID {otp_obj.id}")
        return otp_obj, otp

class UserTokenUsage(models.Model):
    """Tracks token usage for LLM API calls per user"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='token_usage')
    prompt_tokens = models.IntegerField(default=0)
    completion_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    model = models.CharField(max_length=50, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    query_text = models.TextField(blank=True, null=True)  # Store the query for reference
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"Token usage for {self.user.username} on {self.timestamp.strftime('%Y-%m-%d %H:%M')}"
    
    @classmethod
    def record_token_usage(cls, user, prompt_tokens, completion_tokens, model="", query_text=None):
        """Record token usage for a user"""
        try:
            total_tokens = prompt_tokens + completion_tokens
            token_usage = cls(
                user=user,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                model=model,
                query_text=query_text
            )
            token_usage.save()
            logger.info(f"Recorded token usage for user {user.username}: {prompt_tokens} prompt, {completion_tokens} completion")
            return token_usage
        except Exception as e:
            logger.error(f"Error recording token usage: {str(e)}")
            return None
