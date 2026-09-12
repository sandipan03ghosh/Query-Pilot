"""
seed_sample_db — build a small deterministic media-store schema in a dedicated
PostgreSQL schema (default `t2s_sample`) for the demo and eval suite.

Safety:
  - Additive by default (CREATE ... IF NOT EXISTS); rows inserted in one
    transaction only when every data table is empty.
  - Existing tables must match the expected column names and base types exactly,
    or the command aborts (--drop to reset); constraints/nullability not checked.
  - A partially-seeded schema aborts rather than adding rows.
  - --drop is refused under production, needs the _seed_meta marker, and needs
    the schema name retyped (or --yes).

Data is generated from a fixed seed, so gold-query results never shift.
"""
import random

import psycopg2
from psycopg2 import sql as pg_sql
from psycopg2.extras import execute_values
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

SEED_VERSION = "1"
RNG_SEED = 42

# table -> {column: data_type}, in FK-safe insert order.
_EXPECTED = {
    "genres": {"id": "integer", "name": "text"},
    "artists": {"id": "integer", "name": "text", "country": "text"},
    "albums": {"id": "integer", "title": "text", "artist_id": "integer", "release_year": "integer"},
    "tracks": {"id": "integer", "name": "text", "album_id": "integer", "genre_id": "integer",
               "duration_seconds": "integer", "unit_price": "numeric"},
    "customers": {"id": "integer", "first_name": "text", "last_name": "text", "email": "text",
                  "country": "text", "signup_date": "date"},
    "employees": {"id": "integer", "first_name": "text", "last_name": "text", "title": "text",
                  "hire_date": "date", "reports_to": "integer"},
    "invoices": {"id": "integer", "customer_id": "integer", "invoice_date": "date",
                 "billing_country": "text", "total": "numeric"},
    "invoice_lines": {"id": "integer", "invoice_id": "integer", "track_id": "integer",
                      "unit_price": "numeric", "quantity": "integer"},
}
_DATA_TABLES = list(_EXPECTED)

_DDL = [
    "CREATE TABLE IF NOT EXISTS {s}.genres (id int PRIMARY KEY, name text NOT NULL)",
    "CREATE TABLE IF NOT EXISTS {s}.artists (id int PRIMARY KEY, name text NOT NULL, country text)",
    "CREATE TABLE IF NOT EXISTS {s}.albums (id int PRIMARY KEY, title text NOT NULL, "
    "artist_id int NOT NULL REFERENCES {s}.artists(id), release_year int)",
    "CREATE TABLE IF NOT EXISTS {s}.tracks (id int PRIMARY KEY, name text NOT NULL, "
    "album_id int NOT NULL REFERENCES {s}.albums(id), genre_id int REFERENCES {s}.genres(id), "
    "duration_seconds int, unit_price numeric(6,2) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS {s}.customers (id int PRIMARY KEY, first_name text, last_name text, "
    "email text UNIQUE, country text, signup_date date)",
    "CREATE TABLE IF NOT EXISTS {s}.employees (id int PRIMARY KEY, first_name text, last_name text, "
    "title text, hire_date date, reports_to int REFERENCES {s}.employees(id))",
    "CREATE TABLE IF NOT EXISTS {s}.invoices (id int PRIMARY KEY, "
    "customer_id int NOT NULL REFERENCES {s}.customers(id), invoice_date date NOT NULL, "
    "billing_country text, total numeric(10,2) NOT NULL)",
    "CREATE TABLE IF NOT EXISTS {s}.invoice_lines (id int PRIMARY KEY, "
    "invoice_id int NOT NULL REFERENCES {s}.invoices(id), track_id int NOT NULL REFERENCES {s}.tracks(id), "
    "unit_price numeric(6,2) NOT NULL, quantity int NOT NULL)",
]

_COUNTRIES = ["USA", "Canada", "United Kingdom", "Germany", "France", "Brazil", "India", "Australia"]
_GENRES = ["Rock", "Pop", "Jazz", "Classical", "Hip-Hop", "Electronic", "Country", "Metal", "Blues", "Folk"]
_FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Quinn",
          "Devon", "Skyler", "Reese", "Rowan", "Parker"]
_LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
         "Martinez", "Lee", "Walker", "Hall", "Allen", "Young"]
_WORDS = ["Midnight", "Echoes", "Horizon", "Velvet", "Paper", "Golden", "Silent", "Crimson", "Neon",
          "Hollow", "Northern", "Electric", "Wandering", "Glass", "Bright"]


class Command(BaseCommand):
    help = "Seed the deterministic sample schema for the demo and eval suite."

    def add_arguments(self, parser):
        parser.add_argument("--url", default=None, help="Defaults to settings.SAMPLE_DB_URL.")
        parser.add_argument("--schema", default=None, help="Defaults to settings.SAMPLE_DB_SCHEMA.")
        parser.add_argument("--drop", action="store_true", help="Drop the schema first (non-production only).")
        parser.add_argument("--yes", action="store_true", help="Skip the --drop confirmation prompt.")

    def handle(self, *args, **options):
        url = options["url"] or getattr(settings, "SAMPLE_DB_URL", "")
        if not url:
            raise CommandError("No URL: pass --url or set SAMPLE_DB_URL.")
        if options["drop"] and getattr(settings, "IS_PRODUCTION", False):
            raise CommandError("--drop is refused when DJANGO_ENV=production.")

        schema = options["schema"] or getattr(settings, "SAMPLE_DB_SCHEMA", "t2s_sample")
        s_id = pg_sql.Identifier(schema)

        conn = None
        try:
            conn = psycopg2.connect(url, connect_timeout=10)
            with conn:
                with conn.cursor() as cur:
                    if options["drop"]:
                        self._drop_schema(cur, schema, s_id, options["yes"])

                    cur.execute(pg_sql.SQL("CREATE SCHEMA IF NOT EXISTS {s}").format(s=s_id))
                    self._verify_existing_schema(cur, schema)
                    for stmt in _DDL:
                        cur.execute(pg_sql.SQL(stmt).format(s=s_id))
                    self._create_marker(cur, s_id)

                    populated, empty = self._populated_state(cur, s_id)
                    if populated and empty:
                        raise CommandError(
                            f"Partial seed in {schema!r}: {populated} have rows but {empty} are "
                            f"empty. Run with --drop then re-seed."
                        )
                    inserted = 0 if populated else self._seed_rows(cur, s_id)

            self.stdout.write(self.style.SUCCESS(
                f"Sample schema {schema!r} ready "
                f"({'seeded ' + str(inserted) + ' rows' if inserted else 'already populated'})."
            ))
            self.stdout.write("Next: python manage.py create_readonly_role")
        except psycopg2.Error as e:
            raise CommandError(f"PostgreSQL error: {e}")
        finally:
            if conn is not None:
                conn.close()

    # -- helpers ----------------------------------------------------------------

    def _drop_schema(self, cur, schema, s_id, assume_yes):
        cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", (schema,))
        if cur.fetchone() is None:
            return
        cur.execute("SELECT to_regclass(%s)", (f"{schema}._seed_meta",))
        if cur.fetchone()[0] is None:
            raise CommandError(
                f"Schema {schema!r} exists but has no {schema}._seed_meta marker — it was not "
                f"created by this command. Refusing to drop it."
            )
        if not assume_yes:
            if input("Type the schema name to confirm dropping it: ").strip() != schema:
                raise CommandError("Confirmation did not match — aborted.")
        cur.execute(pg_sql.SQL("DROP SCHEMA {s} CASCADE").format(s=s_id))
        self.stdout.write(self.style.WARNING(f"Dropped schema {schema!r}."))

    def _verify_existing_schema(self, cur, schema):
        cur.execute(
            "SELECT table_name, column_name, data_type FROM information_schema.columns "
            "WHERE table_schema = %s AND table_name = ANY(%s)",
            (schema, _DATA_TABLES),
        )
        actual = {}
        for t, c, dt in cur.fetchall():
            actual.setdefault(t, {})[c] = dt

        for table, expected_cols in _EXPECTED.items():
            got = actual.get(table)
            if got is None:
                continue  # DDL creates it
            missing = set(expected_cols) - set(got)
            extra = set(got) - set(expected_cols)
            if missing or extra:
                raise CommandError(
                    f"Table {schema}.{table} column mismatch: missing={sorted(missing)} "
                    f"extra={sorted(extra)}. Run with --drop to reset."
                )
            bad = {c: (expected_cols[c], got[c]) for c in expected_cols if got[c] != expected_cols[c]}
            if bad:
                raise CommandError(
                    f"Table {schema}.{table} type mismatch {bad}. Run with --drop to reset."
                )

    def _create_marker(self, cur, s_id):
        cur.execute(pg_sql.SQL(
            "CREATE TABLE IF NOT EXISTS {s}._seed_meta (key text PRIMARY KEY, value text)"
        ).format(s=s_id))
        cur.execute(pg_sql.SQL(
            "INSERT INTO {s}._seed_meta (key, value) VALUES ('seed_version', %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        ).format(s=s_id), (SEED_VERSION,))

    def _populated_state(self, cur, s_id):
        populated, empty = [], []
        for table in _DATA_TABLES:
            cur.execute(pg_sql.SQL("SELECT EXISTS (SELECT 1 FROM {s}.{t})").format(
                s=s_id, t=pg_sql.Identifier(table)))
            (has_rows,) = cur.fetchone()
            (populated if has_rows else empty).append(table)
        return populated, empty

    def _insert(self, cur, s_id, table, columns, rows):
        if not rows:
            return
        stmt = pg_sql.SQL("INSERT INTO {s}.{t} ({cols}) VALUES %s").format(
            s=s_id, t=pg_sql.Identifier(table),
            cols=pg_sql.SQL(", ").join(pg_sql.Identifier(c) for c in columns),
        ).as_string(cur)
        execute_values(cur, stmt, rows)

    def _seed_rows(self, cur, s_id):
        rng = random.Random(RNG_SEED)
        total = 0

        genres = [(i + 1, name) for i, name in enumerate(_GENRES)]
        self._insert(cur, s_id, "genres", ["id", "name"], genres)
        total += len(genres)

        artists = [
            (i, f"{rng.choice(_WORDS)} {rng.choice(_WORDS)}", rng.choice(_COUNTRIES))
            for i in range(1, 26)
        ]
        self._insert(cur, s_id, "artists", ["id", "name", "country"], artists)
        total += len(artists)

        albums, aid = [], 1
        for artist_id in range(1, 26):
            for _ in range(rng.randint(1, 4)):
                albums.append((aid, f"{rng.choice(_WORDS)} {rng.choice(_WORDS)}",
                               artist_id, rng.randint(1995, 2024)))
                aid += 1
        self._insert(cur, s_id, "albums", ["id", "title", "artist_id", "release_year"], albums)
        total += len(albums)

        tracks, tid = [], 1
        for album_id, *_ in albums:
            for _ in range(rng.randint(6, 12)):
                tracks.append((tid, f"{rng.choice(_WORDS)} {rng.choice(_WORDS)}",
                               album_id, rng.randint(1, len(_GENRES)),
                               rng.randint(120, 360), rng.choice([0.99, 1.29])))
                tid += 1
        self._insert(cur, s_id, "tracks",
                     ["id", "name", "album_id", "genre_id", "duration_seconds", "unit_price"], tracks)
        total += len(tracks)

        customers = []
        for i in range(1, 151):
            fn, ln = rng.choice(_FIRST), rng.choice(_LAST)
            customers.append((i, fn, ln, f"{fn}.{ln}.{i}@example.com".lower(),
                              rng.choice(_COUNTRIES),
                              f"{rng.randint(2019, 2024)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"))
        self._insert(cur, s_id, "customers",
                     ["id", "first_name", "last_name", "email", "country", "signup_date"], customers)
        total += len(customers)

        titles = ["Sales Support Agent", "Sales Manager", "IT Staff", "IT Manager", "General Manager"]
        employees = []
        for i in range(1, 9):
            reports_to = None if i == 1 else rng.randint(1, max(1, i - 1))
            employees.append((i, rng.choice(_FIRST), rng.choice(_LAST), rng.choice(titles),
                              f"{rng.randint(2015, 2022)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}",
                              reports_to))
        self._insert(cur, s_id, "employees",
                     ["id", "first_name", "last_name", "title", "hire_date", "reports_to"], employees)
        total += len(employees)

        invoices, lines, lid = [], [], 1
        track_ids = [t[0] for t in tracks]
        for inv_id in range(1, 301):
            cust = rng.randint(1, 150)
            country = customers[cust - 1][4]
            date = f"{rng.randint(2022, 2024)}-{rng.randint(1, 12):02d}-{rng.randint(1, 28):02d}"
            inv_total = 0.0
            for _ in range(rng.randint(1, 5)):
                track_id = rng.choice(track_ids)
                price = tracks[track_id - 1][5]
                qty = rng.randint(1, 3)
                lines.append((lid, inv_id, track_id, price, qty))
                inv_total += float(price) * qty
                lid += 1
            invoices.append((inv_id, cust, date, country, round(inv_total, 2)))
        self._insert(cur, s_id, "invoices",
                     ["id", "customer_id", "invoice_date", "billing_country", "total"], invoices)
        self._insert(cur, s_id, "invoice_lines",
                     ["id", "invoice_id", "track_id", "unit_price", "quantity"], lines)
        total += len(invoices) + len(lines)

        return total
