from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import models


def _get_fernet():
    key = getattr(settings, "FIELD_ENCRYPTION_KEY", None)
    if not key:
        raise ImproperlyConfigured(
            "FIELD_ENCRYPTION_KEY is not set — required to encrypt/decrypt stored "
            "database credentials. Generate one with Fernet.generate_key() and set it "
            "in backend/.env (never reuse SECRET_KEY for this)."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


class EncryptedCharField(models.CharField):
    """
    A CharField that is transparently encrypted at rest using Fernet symmetric
    encryption, keyed by settings.FIELD_ENCRYPTION_KEY. Used for client database
    connection passwords, which must never be stored in plaintext.

    max_length on this field describes the stored ciphertext's length, not the
    plaintext's — Fernet output is significantly longer than its input (~57 bytes
    fixed overhead plus block padding, then base64-expanded). Callers should pair
    this with a plaintext-length validator sized for the real input instead of
    relying on this field's own max_length to bound the plaintext.
    """

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        if value is None or value == "":
            return value
        return _get_fernet().encrypt(value.encode()).decode()

    def from_db_value(self, value, expression, connection):
        if value is None or value == "":
            return value
        try:
            return _get_fernet().decrypt(value.encode()).decode()
        except InvalidToken:
            # Fail closed rather than silently returning ciphertext as if it were
            # the real password — this only happens for tampered/corrupt rows or
            # a wrong/rotated encryption key.
            raise ValueError(
                "Stored database password could not be decrypted — the encryption "
                "key may have changed, or the stored value is corrupted."
            )
