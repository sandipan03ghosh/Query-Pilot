"""
create_readonly_role — ensure a SELECT-only PostgreSQL role on the sample
database and print the connection details for adding it in the app.

This role is the outer security boundary for query execution (guardrails and the
read-only transaction are inner layers). It gets LOGIN + NOSUPERUSER NOCREATEDB
NOCREATEROLE NOBYPASSRLS NOREPLICATION, CONNECT, schema USAGE, and SELECT on all
current + future tables (default privileges set FOR ROLE every current owner) —
nothing else.

Password is prompted interactively, never a CLI arg, never printed or put in a
URL. A pre-existing role is modified only if this command created it (comment
marker) or --adopt is passed and it is not a superuser.

Idempotent. Run against an admin URL that can CREATE ROLE.
"""
import getpass

import psycopg2
from psycopg2 import sql as pg_sql
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

_MARKER = "managed by create_readonly_role (SELECT-only)"
_MIN_PASSWORD_LEN = 12


class Command(BaseCommand):
    help = "Create/refresh the SELECT-only role on the sample database."

    def add_arguments(self, parser):
        parser.add_argument("--url", default=None,
                            help="Admin connection URL. Defaults to settings.SAMPLE_DB_URL.")
        parser.add_argument("--role", default=None,
                            help="Role name. Defaults to settings.SAMPLE_DB_READONLY_ROLE.")
        parser.add_argument("--schema", default=None,
                            help="Schema to grant SELECT on. Defaults to settings.SAMPLE_DB_SCHEMA.")
        parser.add_argument("--adopt", action="store_true",
                            help="Permit managing a pre-existing role this command did not create "
                                 "(still refused for superusers).")

    def handle(self, *args, **options):
        admin_url = options["url"] or getattr(settings, "SAMPLE_DB_URL", "")
        if not admin_url:
            raise CommandError("No admin URL: pass --url or set SAMPLE_DB_URL.")

        role = options["role"] or getattr(settings, "SAMPLE_DB_READONLY_ROLE", "text2sql_ro")
        schema = options["schema"] or getattr(settings, "SAMPLE_DB_SCHEMA", "t2s_sample")

        password = getpass.getpass(f"Choose a password for the '{role}' role: ")
        if len(password) < _MIN_PASSWORD_LEN:
            raise CommandError(f"Password must be at least {_MIN_PASSWORD_LEN} characters.")
        if password != getpass.getpass("Confirm password: "):
            raise CommandError("Passwords do not match.")

        role_id = pg_sql.Identifier(role)
        schema_id = pg_sql.Identifier(schema)

        conn = None
        try:
            conn = psycopg2.connect(admin_url, connect_timeout=10)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user")
                dbname, admin_user = cur.fetchone()
                db_id = pg_sql.Identifier(dbname)

                cur.execute(
                    "SELECT r.rolsuper, shobj_description(r.oid, 'pg_authid') "
                    "FROM pg_roles r WHERE r.rolname = %s",
                    (role,),
                )
                row = cur.fetchone()
                exists = row is not None
                if exists:
                    rolsuper, comment = row
                    if rolsuper:
                        raise CommandError(
                            f"Role {role!r} exists and is a SUPERUSER — refusing to modify it."
                        )
                    if comment != _MARKER and not options["adopt"]:
                        raise CommandError(
                            f"Role {role!r} already exists and was not created by this command. "
                            f"Re-run with --adopt to manage it (it is not a superuser)."
                        )

                attrs = ("LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE "
                         "NOBYPASSRLS NOREPLICATION PASSWORD %s")
                verb = "ALTER" if exists else "CREATE"
                cur.execute(
                    pg_sql.SQL(verb + " ROLE {r} WITH " + attrs).format(r=role_id),
                    (password,),
                )
                cur.execute(pg_sql.SQL("COMMENT ON ROLE {r} IS %s").format(r=role_id), (_MARKER,))

                cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                            (schema,))
                if cur.fetchone() is None:
                    raise CommandError(f"Schema {schema!r} does not exist. Run seed_sample_db first.")

                cur.execute(pg_sql.SQL("GRANT CONNECT ON DATABASE {db} TO {r}").format(db=db_id, r=role_id))
                cur.execute(pg_sql.SQL("GRANT USAGE ON SCHEMA {s} TO {r}").format(s=schema_id, r=role_id))
                cur.execute(pg_sql.SQL("GRANT SELECT ON ALL TABLES IN SCHEMA {s} TO {r}").format(s=schema_id, r=role_id))

                # Default privileges are per granting-role: set FOR ROLE every
                # current table owner here, plus the admin role.
                cur.execute("SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = %s", (schema,))
                owners = {r[0] for r in cur.fetchall()} | {admin_user}
                for owner in sorted(owners):
                    cur.execute(
                        pg_sql.SQL(
                            "ALTER DEFAULT PRIVILEGES FOR ROLE {o} IN SCHEMA {s} "
                            "GRANT SELECT ON TABLES TO {r}"
                        ).format(o=pg_sql.Identifier(owner), s=schema_id, r=role_id),
                    )

                cur.execute("SELECT inet_server_addr(), inet_server_port()")
                server_addr, server_port = cur.fetchone()

            self.stdout.write(self.style.SUCCESS(
                f"{'Updated' if exists else 'Created'} role {role!r} on database {dbname!r}."
            ))
            self.stdout.write("")
            self.stdout.write("Add the sample database in the app with:")
            self.stdout.write(f"  host:     {server_addr or '(same host as SAMPLE_DB_URL)'}")
            self.stdout.write(f"  port:     {server_port or 5432}")
            self.stdout.write(f"  database: {dbname}")
            self.stdout.write(f"  username: {role}")
            self.stdout.write("  password: (the password you just entered — not stored or printed)")
            self.stdout.write(f"  -> query tables in schema {schema!r}")
        except psycopg2.Error as e:
            raise CommandError(f"PostgreSQL error: {e}")
        finally:
            if conn is not None:
                conn.close()
