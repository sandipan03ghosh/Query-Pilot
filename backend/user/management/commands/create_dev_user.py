"""
create_dev_user — create a local user and print a JWT pair, so the app can be
used without a Firebase project.

Gated on settings.DEV_AUTH_BYPASS (which itself requires a non-production
environment + DEBUG). Refuses to run otherwise.
"""
import getpass

from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from rest_framework_simplejwt.tokens import RefreshToken


class Command(BaseCommand):
    help = "Create a development user and print a JWT access/refresh pair."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument(
            "--password", default=None,
            help="Prompted for if omitted; passing it here leaves it in shell history.",
        )
        parser.add_argument("--username", default=None,
                            help="Defaults to the local part of the email.")

    def handle(self, *args, **options):
        if not getattr(settings, "DEV_AUTH_BYPASS", False):
            raise CommandError(
                "DEV_AUTH_BYPASS is off. This command only runs in a development "
                "environment (DJANGO_ENV != production, DEBUG=True, "
                "DEV_AUTH_BYPASS=True)."
            )

        email = options["email"].strip().lower()
        username = options["username"] or email.split("@")[0]

        password = options["password"]
        if password:
            self.stderr.write(self.style.WARNING(
                "Password passed on the command line — it is in your shell history."
            ))
        else:
            password = getpass.getpass("Password for dev user: ")
            if not password:
                raise CommandError("Empty password.")

        user, created = User.objects.get_or_create(
            email=email, defaults={"username": username},
        )

        # Enforce AUTH_PASSWORD_VALIDATORS.
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise CommandError("Weak password: " + "; ".join(exc.messages))

        user.set_password(password)
        user.save()

        refresh = RefreshToken.for_user(user)
        refresh["username"] = user.username

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} dev user {user.username} <{email}>"))
        self.stdout.write("")
        self.stdout.write("access:  " + str(refresh.access_token))
        self.stdout.write("refresh: " + str(refresh))
        self.stdout.write("")
        self.stdout.write(
            "Sign in with this email + password in the frontend's native form. The "
            "printed tokens are for API testing; this bypass is dev-only."
        )
