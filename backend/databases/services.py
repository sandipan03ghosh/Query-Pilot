import logging
import psycopg2
import pytz
from datetime import datetime
from .models import (
    ClientDatabase, TableMetadata, ColumnMetadata, RelationshipMetadata,
    QueryExecutionLog, CONNECTION_STATUS,
)
from .guardrails import GuardrailPipeline

logger = logging.getLogger(__name__)

# Known scan nodes (fast path); _is_scan_node also accepts any "... Scan" type
# so a new node type in a future PG version isn't missed.
_SCAN_NODE_TYPES = {
    "Seq Scan", "Index Scan", "Index Only Scan", "Bitmap Heap Scan",
    "Bitmap Index Scan", "Tid Scan", "Tid Range Scan", "Foreign Scan",
    "Table Function Scan", "Sample Scan", "Custom Scan",
}


def _is_scan_node(node_type):
    return node_type in _SCAN_NODE_TYPES or str(node_type).endswith("Scan")


def _estimate_scan_rows(explain_json):
    """Sum the planner's `Plan Rows` across scan nodes in an EXPLAIN (FORMAT JSON)
    tree.

    A PROXY, not an exact count: `Plan Rows` is the post-filter estimate a node
    emits and can be far off on skewed data — enough to catch a query churning
    millions of rows, not a guarantee. Non-numeric / missing values are skipped.
    Returns the sum, or None if the plan shape is unrecognised.
    """
    try:
        root = explain_json[0]["Plan"] if isinstance(explain_json, list) else explain_json["Plan"]
    except (KeyError, IndexError, TypeError):
        return None

    total = 0.0
    seen_scan = False
    stack = [root]
    while stack:
        node = stack.pop()
        if not isinstance(node, dict):
            continue
        if _is_scan_node(node.get("Node Type")):
            seen_scan = True
            try:
                total += float(node.get("Plan Rows"))
            except (TypeError, ValueError):
                pass
        children = node.get("Plans")
        if isinstance(children, list):
            stack.extend(children)

    return total if seen_scan else 0.0  # no scan nodes -> nothing to cap


def _plan_total_cost(explain_json):
    """Planner total-cost estimate for the whole query — display/logging only."""
    try:
        root = explain_json[0]["Plan"] if isinstance(explain_json, list) else explain_json["Plan"]
        cost = root.get("Total Cost")
        return float(cost) if cost is not None else None
    except (KeyError, IndexError, TypeError, ValueError):
        return None


class RestrictedRoleError(Exception):
    """Raised when a query-execution connection uses a non-restricted role
    (superuser, BYPASSRLS, CREATEDB/CREATEROLE, or write/DDL privileges). In
    production we refuse rather than lean on guardrails + read-only txn alone."""


# Per-database role-safety verdicts, so the introspection queries don't run on
# every execution. {db_id: (mono_ts, problems)}
_ROLE_SAFETY_CACHE = {}
_ROLE_SAFETY_TTL_SECONDS = 300

# Role-level attributes that make a role unsuitable for query execution.
_ROLE_ATTR_SQL = """
    SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
    FROM pg_roles WHERE rolname = current_user
"""
# True if current_user can write to ANY user table (directly or via group roles).
_WRITE_PRIVILEGE_SQL = """
    SELECT bool_or(
        has_table_privilege(current_user, c.oid, 'INSERT')
     OR has_table_privilege(current_user, c.oid, 'UPDATE')
     OR has_table_privilege(current_user, c.oid, 'DELETE')
     OR has_table_privilege(current_user, c.oid, 'TRUNCATE'))
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
"""
# True if current_user can CREATE objects in ANY user schema.
_SCHEMA_CREATE_SQL = """
    SELECT bool_or(has_schema_privilege(current_user, n.oid, 'CREATE'))
    FROM pg_namespace n
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
"""


class DatabaseConnector:
    """Handles database connection and basic operations"""

    def create_connection(self, database_obj, *, for_query_execution=False):
        """Connect using the stored credentials.

        The outer security layer is the PostgreSQL role itself, which must be
        SELECT-only (`create_readonly_role`). With for_query_execution=True this
        sets the session READ ONLY and checks the role is restricted — warn in
        dev, raise RestrictedRoleError in production.
        """
        try:
            if database_obj.database_type == 'postgresql':
                conn = psycopg2.connect(
                    dbname=database_obj.database_name,
                    user=database_obj.username,
                    password=database_obj.password,
                    host=database_obj.host,
                    port=database_obj.port,
                    connect_timeout=5
                )
                if for_query_execution:
                    self._enforce_query_connection_safety(conn, database_obj)
                database_obj.connection_status = 'connected'
                database_obj.save(update_fields=['connection_status'])
                return conn
            else:
                raise ValueError(f"Unsupported database type: {database_obj.database_type}")
        except Exception as e:
            database_obj.connection_status = 'error'
            database_obj.save(update_fields=['connection_status'])
            raise e

    def _enforce_query_connection_safety(self, conn, database_obj):
        """Set `conn` READ ONLY and verify the role is restricted (verdict cached
        per database for _ROLE_SAFETY_TTL_SECONDS)."""
        import time
        from django.conf import settings

        # libpq read-only session first — holds regardless of the verdict below.
        conn.set_session(readonly=True, autocommit=False)

        is_production = bool(getattr(settings, "IS_PRODUCTION", False))
        now = time.monotonic()
        cached = _ROLE_SAFETY_CACHE.get(database_obj.id)
        if cached and now - cached[0] < _ROLE_SAFETY_TTL_SECONDS:
            problems = cached[1]
        else:
            problems = self._introspect_role_problems(conn, database_obj, is_production)
            _ROLE_SAFETY_CACHE[database_obj.id] = (now, problems)

        if not problems:
            return
        summary = "; ".join(problems)
        if is_production:
            raise RestrictedRoleError(
                f"Refusing to run queries against database {database_obj.id}: the "
                f"connection role is not restricted ({summary}). Configure a "
                f"SELECT-only role — see the create_readonly_role command."
            )
        logger.warning(
            "Query role for database %s is NOT restricted (%s). The READ ONLY "
            "session + guardrails are the only protection; use create_readonly_role.",
            database_obj.id, summary,
        )

    @staticmethod
    def _introspect_role_problems(conn, database_obj, is_production):
        problems = []
        try:
            with conn.cursor() as cur:
                cur.execute(_ROLE_ATTR_SQL)
                row = cur.fetchone()
                if row:
                    rolsuper, rolbypassrls, rolcreatedb, rolcreaterole = row
                    if rolsuper:
                        problems.append("role is a superuser")
                    if rolbypassrls:
                        problems.append("role has BYPASSRLS")
                    if rolcreatedb:
                        problems.append("role has CREATEDB")
                    if rolcreaterole:
                        problems.append("role has CREATEROLE")

                cur.execute(_WRITE_PRIVILEGE_SQL)
                if (cur.fetchone() or [None])[0]:
                    problems.append("role holds INSERT/UPDATE/DELETE/TRUNCATE on user tables")

                cur.execute(_SCHEMA_CREATE_SQL)
                if (cur.fetchone() or [None])[0]:
                    problems.append("role holds CREATE on a user schema")
            conn.rollback()
        except Exception as exc:  # noqa: BLE001
            conn.rollback()
            msg = f"could not verify role privileges ({exc})"
            if is_production:
                # Fail closed: can't prove the role is safe -> don't run.
                raise RestrictedRoleError(
                    f"Refusing to run queries against database {database_obj.id}: {msg}."
                ) from exc
            logger.warning("Database %s: %s — proceeding (non-production).", database_obj.id, msg)
        return problems
    
    def test_connection(self, database_obj):
        """Test if the database connection works"""
        try:
            conn = self.create_connection(database_obj)
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                result = cursor.fetchone()
            conn.close()
            database_obj.connection_status = 'disconnected'  # Set to disconnected after successful test
            database_obj.save(update_fields=['connection_status'])
            return True, "Connection successful"
        except Exception as e:
            return False, str(e)
    
    def execute_query(self, database_obj, query, params=None, *, user=None, nl_question=None):
        """Execute one read-only SQL statement against a client database.

        Layers, outermost first:
          0. restricted PG role — verified by create_connection (raises in prod).
          1. GuardrailPipeline (require_explain=True).
          2. a final EXPLAIN on the exact SQL about to run — fails closed.
          3. READ ONLY session; the transaction is always rolled back, never committed.

        Blocked and executed attempts both go to QueryExecutionLog. user /
        nl_question feed only that audit row. Client-facing errors are generic.
        """
        results = {"columns": [], "rows": [], "status": "", "execution_time": None}
        start_time = datetime.now()
        conn = None
        report = None
        executed_sql = query  # becomes the guardrail-rewritten SQL later

        def _elapsed():
            return (datetime.now() - start_time).total_seconds()

        def _blocked(rule, reason):
            QueryExecutionLog.record(
                outcome=QueryExecutionLog.OUTCOME_BLOCKED,
                sql=executed_sql, database=database_obj, user=user,
                nl_question=nl_question, blocked_rule=rule, blocked_reason=reason,
            )
            results.update(
                success=False,
                status=f"Blocked by guardrail: {reason}",
                error_type="blocked_statement",
                blocked_rule=rule,
                guardrail_warnings=(report.warnings if report else []),
                execution_time=_elapsed(),
            )
            self._mark_status(database_obj, 'disconnected')
            return results

        try:
            logger.debug("Executing user query (database_id=%s)", database_obj.id)
            conn = self.create_connection(database_obj, for_query_execution=True)

            captured = {}
            with conn.cursor() as cursor:
                def _explain(sql_to_check):
                    cursor.execute("EXPLAIN (FORMAT JSON) " + sql_to_check, params)
                    raw = cursor.fetchone()[0]
                    captured["json"] = raw
                    captured["for_sql"] = sql_to_check
                    return _estimate_scan_rows(raw)

                report = GuardrailPipeline().check(
                    query,
                    read_only=database_obj.read_only,
                    explain=_explain,
                    require_explain=True,
                )
                if not report.passed:
                    conn.rollback()
                    return _blocked(report.blocked_rule, report.blocked_reason)

                executed_sql = report.sql

                # Layer 2 — final EXPLAIN of the exact SQL about to run. Fails
                # closed: no confirmation -> no execution.
                if captured.get("for_sql") != executed_sql or "json" not in captured:
                    try:
                        cursor.execute("EXPLAIN (FORMAT JSON) " + executed_sql, params)
                        captured["json"] = cursor.fetchone()[0]
                    except Exception as exc:  # noqa: BLE001
                        conn.rollback()
                        logger.warning(
                            "Final EXPLAIN failed for database %s: %s", database_obj.id, exc,
                        )
                        return _blocked(
                            "explain_row_estimate",
                            "The query could not be verified with EXPLAIN before execution.",
                        )

                cursor.execute(executed_sql, params)
                results["execution_time"] = _elapsed()

                if cursor.description:
                    results["columns"] = [d[0] for d in cursor.description]
                    results["rows"] = [
                        [
                            v.strftime('%Y-%m-%d %H:%M:%S')
                            if isinstance(v, (datetime, pytz.datetime.datetime)) else v
                            for v in row
                        ]
                        for row in cursor.fetchall()
                    ]
                    results["status"] = f"Query returned {len(results['rows'])} rows"
                else:
                    results["status"] = "Query executed (no result set)."

                conn.rollback()  # layer 3 — never commit

            plan_json = captured.get("json")
            results.update(
                success=True,
                explain_plan=plan_json,
                scan_row_estimate=_estimate_scan_rows(plan_json) if plan_json else None,
                plan_total_cost=_plan_total_cost(plan_json) if plan_json else None,
                guardrail_warnings=report.warnings,
            )
            QueryExecutionLog.record(
                outcome=QueryExecutionLog.OUTCOME_EXECUTED,
                sql=executed_sql, database=database_obj, user=user,
                nl_question=nl_question,
                row_count=len(results["rows"]),
                execution_time_ms=results["execution_time"] * 1000,
            )
            self._mark_status(database_obj, 'disconnected')
            return results

        except RestrictedRoleError as e:
            logger.error("Refused query on database %s: %s", database_obj.id, e)
            results["execution_time"] = _elapsed()
            results["success"] = False
            results["error_type"] = "restricted_role_required"
            results["status"] = (
                "This database connection is not using a read-only role, so "
                "queries are refused. Configure a SELECT-only role."
            )
            self._mark_status(database_obj, 'error')
            return results
        except Exception as e:
            if conn is not None:
                try:
                    conn.rollback()
                except Exception:  # noqa: BLE001
                    pass
            error_type = self._classify_db_error(str(e))
            logger.warning(
                "Query execution failed (database_id=%s, type=%s): %s",
                database_obj.id, error_type, e,
            )
            results["execution_time"] = _elapsed()
            results["success"] = False
            results["error_type"] = error_type
            results["status"] = self._user_facing_error(error_type, str(e))
            if report is not None and report.warnings:
                results["guardrail_warnings"] = report.warnings
            QueryExecutionLog.record(
                outcome=QueryExecutionLog.OUTCOME_FAILED,
                sql=executed_sql, database=database_obj, user=user,
                nl_question=nl_question, error=str(e),
            )
            self._mark_status(database_obj, 'error')
            return results
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:  # noqa: BLE001
                    pass
    
    def get_column_sample_values(self, database_obj, schema_name, table_name, column_name, limit=10):
        """Fetch sample distinct values from a column to provide AI context"""
        try:
            conn = self.create_connection(database_obj)
            results = []
            
            with conn.cursor() as cursor:
                # Use SQL DISTINCT to get unique values, limit to 10 for context
                query = f"""
                SELECT DISTINCT "{column_name}" 
                FROM "{schema_name}"."{table_name}"
                WHERE "{column_name}" IS NOT NULL
                LIMIT {limit}
                """
                
                try:
                    cursor.execute(query)
                    rows = cursor.fetchall()
                    
                    for row in rows:
                        # Handle different data types for serialization
                        value = row[0]
                        if isinstance(value, (datetime, pytz.datetime.datetime)):
                            value = value.strftime('%Y-%m-%d %H:%M:%S')
                        
                        results.append(value)
                except Exception as e:
                    # If query fails, just return empty list
                    logger.warning("Error getting sample values: %s", str(e))

            conn.close()
            return results
        except Exception as e:
            logger.warning("Connection error getting sample values: %s", str(e))
            return []

    # Data types we never profile (too large / not meaningfully categorical).
    _UNPROFILEABLE_TYPES = {"bytea", "json", "jsonb", "xml", "tsvector", "tsquery"}

    def profile_column(self, database_obj, schema_name, table_name, column_name,
                       data_type="", categorical_threshold=50, sample_limit=8):
        """Return {"is_categorical": bool, "sample_values": [...]} for a column.

        One bounded query (DISTINCT ... LIMIT threshold+1), cheap on large tables.
        is_categorical is True at <= categorical_threshold distinct non-null
        values. Identifiers quoted via psycopg2.sql.Identifier.
        """
        from psycopg2 import sql as pg_sql

        if (data_type or "").lower() in self._UNPROFILEABLE_TYPES:
            return {"is_categorical": False, "sample_values": []}

        categorical_threshold = max(1, min(int(categorical_threshold), 1000))
        sample_limit = max(0, min(int(sample_limit), 50))

        conn = None
        try:
            conn = self.create_connection(database_obj)
            with conn.cursor() as cursor:
                query = pg_sql.SQL(
                    "SELECT DISTINCT {col} FROM {sch}.{tbl} "
                    "WHERE {col} IS NOT NULL LIMIT {lim}"
                ).format(
                    col=pg_sql.Identifier(column_name),
                    sch=pg_sql.Identifier(schema_name),
                    tbl=pg_sql.Identifier(table_name),
                    lim=pg_sql.Literal(categorical_threshold + 1),
                )
                cursor.execute(query)
                rows = [r[0] for r in cursor.fetchall()]

            is_categorical = len(rows) <= categorical_threshold
            values = []
            if is_categorical:
                for v in rows[:sample_limit]:
                    if isinstance(v, (datetime, pytz.datetime.datetime)):
                        v = v.strftime('%Y-%m-%d %H:%M:%S')
                    elif v is not None and not isinstance(v, (str, int, float, bool)):
                        v = str(v)
                    values.append(v)
            return {"is_categorical": is_categorical, "sample_values": values}
        except Exception as e:  # noqa: BLE001
            logger.warning("profile_column failed for %s.%s.%s: %s",
                           schema_name, table_name, column_name, e)
            return {"is_categorical": False, "sample_values": []}
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:  # noqa: BLE001
                    pass


class MetadataExtractor:
    """Extracts schema metadata from connected databases"""
    
    def __init__(self):
        self.connector = DatabaseConnector()
        self.changes = {
            'tables': {'added': [], 'updated': [], 'removed': []},
            'columns': {'added': [], 'updated': [], 'removed': []},
            'relationships': {'added': [], 'updated': [], 'removed': []}
        }
    
    def extract_full_metadata(self, database_obj):
        """Extract all metadata (tables, columns, relationships) from a database"""
        try:
            # Reset changes tracking
            self.changes = {
                'tables': {'added': [], 'updated': [], 'removed': []},
                'columns': {'added': [], 'updated': [], 'removed': []},
                'relationships': {'added': [], 'updated': [], 'removed': []}
            }
            
            # Get all current tables in database to track removed tables
            existing_tables = set(TableMetadata.objects.filter(database=database_obj)
                                 .values_list('schema_name', 'table_name'))
            
            # Get tables first
            tables = self.extract_tables(database_obj)
            
            # Check for removed tables
            current_tables = set((table.schema_name, table.table_name) for table in tables)
            removed_tables = existing_tables - current_tables
            
            # Record removed tables
            for schema_name, table_name in removed_tables:
                try:
                    table = TableMetadata.objects.get(
                        database=database_obj,
                        schema_name=schema_name,
                        table_name=table_name
                    )
                    self.changes['tables']['removed'].append({
                        'schema': schema_name,
                        'name': table_name
                    })
                    table.delete()
                except TableMetadata.DoesNotExist:
                    continue  # Table was already deleted somehow
            
            # For each table, get its columns
            for table in tables:
                # Get current columns in table to track removed columns
                existing_columns = set(
                    ColumnMetadata.objects.filter(table=table)
                    .values_list('column_name', flat=True)
                )
                
                # Extract columns
                columns = self.extract_columns(database_obj, table.schema_name, table.table_name)
                
                # Check for removed columns
                current_columns = set(col.column_name for col in columns)
                removed_columns = existing_columns - current_columns
                
                # Record removed columns
                for column_name in removed_columns:
                    try:
                        column = ColumnMetadata.objects.get(
                            table=table,
                            column_name=column_name
                        )
                        self.changes['columns']['removed'].append({
                            'table': f"{table.schema_name}.{table.table_name}",
                            'name': column_name
                        })
                        column.delete()
                    except ColumnMetadata.DoesNotExist:
                        continue  # Column was already deleted
            
            # Extract relationships between tables
            self.extract_relationships(database_obj)
            
            # Update the timestamp for metadata update
            database_obj.last_metadata_update = datetime.now(pytz.UTC)
            database_obj.save(update_fields=['last_metadata_update'])
            
            return True, "Metadata extraction completed successfully", self.changes
        except Exception as e:
            return False, str(e), self.changes
    
    def extract_tables(self, database_obj, schema_pattern=None):
        """Extract tables and views from the database"""
        tables = []
        
        try:
            conn = self.connector.create_connection(database_obj)
            with conn.cursor() as cursor:
                query = """
                SELECT 
                    table_schema, 
                    table_name, 
                    table_type,
                    obj_description(
                        (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass::oid, 
                        'pg_class'
                    ) as description
                FROM 
                    information_schema.tables 
                WHERE 
                    table_schema NOT IN ('pg_catalog', 'information_schema')
                """
                
                if schema_pattern:
                    query += " AND table_schema LIKE %s"
                    cursor.execute(query, (schema_pattern,))
                else:
                    cursor.execute(query)
                
                for row in cursor.fetchall():
                    schema_name, table_name, table_type, db_description = row
                    
                    # Convert PostgreSQL table_type to our format
                    if table_type == 'BASE TABLE':
                        table_type = 'table'
                    elif table_type == 'VIEW':
                        table_type = 'view'
                    elif table_type == 'MATERIALIZED VIEW':
                        table_type = 'materialized_view'
                    
                    # Try to find existing table metadata to preserve description
                    try:
                        existing_table = TableMetadata.objects.get(
                            database=database_obj,
                            schema_name=schema_name,
                            table_name=table_name
                        )
                        # Preserve existing description if it exists and not empty
                        description = existing_table.description if existing_table.description else db_description
                    except TableMetadata.DoesNotExist:
                        description = db_description if db_description else ""
                    
                    # Get or create table metadata record
                    table_meta, created = TableMetadata.objects.update_or_create(
                        database=database_obj,
                        schema_name=schema_name,
                        table_name=table_name,
                        defaults={
                            'table_type': table_type,
                            'description': description
                        }
                    )
                    
                    # Generate default description if none exists
                    if not table_meta.description:
                        table_meta.description = self.generate_table_description(table_meta)
                        table_meta.save(update_fields=['description'])
                    
                    # Track changes
                    if created:
                        self.changes['tables']['added'].append({
                            'schema': schema_name,
                            'name': table_name,
                            'type': table_type
                        })
                    elif table_meta.table_type != table_type:
                        # Only count as update if table type changed, not description
                        self.changes['tables']['updated'].append({
                            'schema': schema_name,
                            'name': table_name,
                            'type': table_type,
                            'changes': {
                                'type': table_type if table_meta.table_type != table_type else None,
                            }
                        })
                    
                    # Get row count for tables (not views)
                    if table_type == 'table':
                        try:
                            count_query = f'SELECT COUNT(*) FROM "{schema_name}"."{table_name}"'
                            cursor.execute(count_query)
                            row_count = cursor.fetchone()[0]
                            if table_meta.row_count != row_count:
                                table_meta.row_count = row_count
                                table_meta.save(update_fields=['row_count'])
                        except:
                            # Skip row count if it fails
                            pass
                    
                    tables.append(table_meta)
            
            conn.close()
            return tables
        
        except Exception as e:
            # Cleanup connection and re-raise
            if 'conn' in locals() and conn:
                conn.close()
            raise e
    
    def extract_columns(self, database_obj, schema_name, table_name):
        """Extract column metadata for a specific table"""
        columns = []
        
        try:
            conn = self.connector.create_connection(database_obj)
            table = TableMetadata.objects.get(
                database=database_obj, 
                schema_name=schema_name, 
                table_name=table_name
            )
            
            with conn.cursor() as cursor:
                # Get column information
                cursor.execute("""
                SELECT 
                    column_name, 
                    data_type,
                    is_nullable,
                    column_default,
                    col_description(
                        (quote_ident(table_schema) || '.' || quote_ident(table_name))::regclass::oid,
                        ordinal_position
                    ) as description
                FROM 
                    information_schema.columns
                WHERE 
                    table_schema = %s AND table_name = %s
                ORDER BY 
                    ordinal_position
                """, (schema_name, table_name))
                
                for row in cursor.fetchall():
                    column_name, data_type, is_nullable, column_default, db_description = row
                    is_nullable = True if is_nullable == 'YES' else False
                    
                    # Check if column is primary key
                    cursor.execute("""
                    SELECT 
                        c.column_name
                    FROM 
                        information_schema.table_constraints tc
                    JOIN 
                        information_schema.constraint_column_usage AS ccu 
                        USING (constraint_schema, constraint_name)
                    JOIN 
                        information_schema.columns AS c 
                        ON c.table_schema = tc.constraint_schema
                        AND c.table_name = tc.table_name
                        AND c.column_name = ccu.column_name
                    WHERE 
                        tc.constraint_type = 'PRIMARY KEY'
                        AND tc.table_schema = %s
                        AND tc.table_name = %s
                        AND ccu.column_name = %s
                    """, (schema_name, table_name, column_name))
                    
                    is_primary_key = bool(cursor.fetchone())
                    
                    # Check if column is foreign key
                    cursor.execute("""
                    SELECT 
                        ccu.table_schema, 
                        ccu.table_name, 
                        ccu.column_name
                    FROM 
                        information_schema.table_constraints AS tc
                    JOIN 
                        information_schema.constraint_column_usage AS ccu
                        USING (constraint_schema, constraint_name)
                    JOIN 
                        information_schema.key_column_usage AS kcu
                        USING (constraint_schema, constraint_name)
                    WHERE 
                        tc.constraint_type = 'FOREIGN KEY'
                        AND kcu.table_schema = %s
                        AND kcu.table_name = %s
                        AND kcu.column_name = %s
                    """, (schema_name, table_name, column_name))
                    
                    is_foreign_key = bool(cursor.fetchone())
                    
                    # Try to find existing column to preserve its description
                    try:
                        existing_column = ColumnMetadata.objects.get(
                            table=table,
                            column_name=column_name
                        )
                        # Preserve existing description if it exists
                        description = existing_column.description if existing_column.description else db_description
                    except ColumnMetadata.DoesNotExist:
                        description = db_description if db_description else ""
                    
                    # Categorical sample values (gated by
                    # LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT at prompt build).
                    profile = self.connector.profile_column(
                        database_obj, schema_name, table_name, column_name, data_type,
                    ) or {}

                    # Create or update column metadata
                    column_meta, created = ColumnMetadata.objects.update_or_create(
                        table=table,
                        column_name=column_name,
                        defaults={
                            'data_type': data_type,
                            'is_nullable': is_nullable,
                            'is_primary_key': is_primary_key,
                            'is_foreign_key': is_foreign_key,
                            'description': description,
                            'is_categorical': bool(profile.get('is_categorical', False)),
                            'sample_values': profile.get('sample_values', []) or [],
                        }
                    )

                    # Generate default description if none exists
                    if not column_meta.description:
                        column_meta.description = self.generate_column_description(column_meta)
                        column_meta.save(update_fields=['description'])
                    
                    # Track changes
                    if created:
                        self.changes['columns']['added'].append({
                            'table': f"{schema_name}.{table_name}",
                            'name': column_name,
                            'type': data_type
                        })
                    else:
                        changes = {}
                        if column_meta.data_type != data_type:
                            changes['type'] = data_type
                        if column_meta.is_nullable != is_nullable:
                            changes['nullable'] = is_nullable
                        if column_meta.is_primary_key != is_primary_key:
                            changes['primary_key'] = is_primary_key
                        if column_meta.is_foreign_key != is_foreign_key:
                            changes['foreign_key'] = is_foreign_key
                        
                        # Don't include description in changes since we're preserving it
                            
                        if changes:
                            self.changes['columns']['updated'].append({
                                'table': f"{schema_name}.{table_name}",
                                'name': column_name,
                                'changes': changes
                            })
                    
                    columns.append(column_meta)
            
            conn.close()
            return columns
        
        except Exception as e:
            # Cleanup connection and re-raise
            if 'conn' in locals() and conn:
                conn.close()
            raise e
    
    def extract_relationships(self, database_obj):
        """Extract relationships between tables in the database"""
        try:
            conn = self.connector.create_connection(database_obj)
            with conn.cursor() as cursor:
                # Query to find foreign key relationships
                cursor.execute("""
                SELECT
                    kcu.table_schema as fk_schema,
                    kcu.table_name as fk_table,
                    kcu.column_name as fk_column,
                    ccu.table_schema as pk_schema,
                    ccu.table_name as pk_table,
                    ccu.column_name as pk_column,
                    tc.constraint_name
                FROM
                    information_schema.table_constraints tc
                JOIN
                    information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN
                    information_schema.constraint_column_usage ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE
                    tc.constraint_type = 'FOREIGN KEY'
                    AND kcu.table_schema NOT IN ('pg_catalog', 'information_schema')
                """)
                
                for row in cursor.fetchall():
                    fk_schema, fk_table, fk_column, pk_schema, pk_table, pk_column, constraint_name = row
                    
                    try:
                        # Get the table metadata objects
                        fk_table_meta = TableMetadata.objects.get(
                            database=database_obj,
                            schema_name=fk_schema,
                            table_name=fk_table
                        )
                        
                        pk_table_meta = TableMetadata.objects.get(
                            database=database_obj,
                            schema_name=pk_schema,
                            table_name=pk_table
                        )
                        
                        # Get the column metadata objects
                        from_column = ColumnMetadata.objects.get(
                            table=fk_table_meta,
                            column_name=fk_column
                        )
                        
                        to_column = ColumnMetadata.objects.get(
                            table=pk_table_meta,
                            column_name=pk_column
                        )
                        
                        # Create or update relationship
                        relationship, created = RelationshipMetadata.objects.update_or_create(
                            from_column=from_column,
                            to_column=to_column,
                            defaults={
                                'relationship_type': 'many-to-one'  # Assuming foreign keys create many-to-one relationships
                            }
                        )
                    except (TableMetadata.DoesNotExist, ColumnMetadata.DoesNotExist):
                        # Skip if the tables or columns aren't in our metadata yet
                        continue
            
            conn.close()
            return True
        
        except Exception as e:
            # Cleanup connection and re-raise
            if 'conn' in locals() and conn:
                conn.close()
            raise e
    
    def generate_table_description(self, table_metadata):
        """Generate natural language description of table (placeholder)"""
        return f"Table {table_metadata.schema_name}.{table_metadata.table_name} containing data related to {table_metadata.table_name.lower().replace('_', ' ')}."
    
    def generate_column_description(self, column_metadata):
        """Plain, value-free column description (placeholder).

        Must not embed sample values: descriptions always go to the LLM, but
        sample values are gated by LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT — baking
        them in here would bypass that control.
        """
        column_type = f"of type {column_metadata.data_type}"
        nullability = "nullable" if column_metadata.is_nullable else "not nullable"
        key_info = ""
        if column_metadata.is_primary_key:
            key_info = " and serves as the primary key"
        elif column_metadata.is_foreign_key:
            key_info = " and references another table"
        return f"Column {column_metadata.column_name} {column_type} ({nullability}){key_info}."

class MetadataVectorizer:
    """
    Kept as a thin, contract-preserving wrapper around the real embedding/
    retrieval pipeline in llm_agent.semantic — DatabaseViewSet's
    update_embeddings/search actions call this class unchanged, so no view or
    frontend code needed to change for this cutover. The old hardcoded
    placeholder vectors ([0.1, 0.2, 0.3]-style dummy data) and the
    embedding_vector JSON columns they wrote to have been removed entirely —
    real vectors now live only in the FAISS indexes llm_agent.semantic manages.
    """

    def update_all_embeddings(self, database_obj):
        """Update all embeddings for a database using the active embedding model."""
        from llm_agent.semantic import embedding_service
        try:
            result = embedding_service.update_all_embeddings(database_obj)
            return result.get("success", False), result.get("message", "")
        except Exception as e:
            return False, str(e)

    def search_metadata(self, database_obj, query_text, limit=10, mode="hybrid"):
        """Hybrid vector+keyword search, degrading gracefully to keyword-only
        if no embedding model is active or its FAISS index doesn't exist yet."""
        from llm_agent.semantic import retrieval_service
        return retrieval_service.search_metadata(database_obj, query_text, limit=limit, mode=mode)

def generate_er_diagram(database_id):
    """
    Generate an ER diagram representation for a database in JSON format
    
    Args:
        database_id (int): The database ID to generate diagram for
        
    Returns:
        dict: JSON representation of the database ER diagram
    """
    try:
        from .models import TableMetadata, ColumnMetadata, RelationshipMetadata, ClientDatabase, ERDiagram
        from datetime import datetime

        # Get database schema information
        tables = TableMetadata.objects.filter(database_id=database_id)
        
        if not tables:
            return {
                "success": False, 
                "error": "No schema information available for this database"
            }
        
        # Build nodes (tables)
        nodes = []
        node_positions = {}
        
        # Calculate initial positions for tables
        grid_size = int(len(tables) ** 0.5) + 1
        grid_spacing = 300
        
        for i, table in enumerate(tables):
            # Calculate grid position
            row = i // grid_size
            col = i % grid_size
            
            # Generate a unique ID for this table
            table_id = f"{table.schema_name}.{table.table_name}"
            
            # Create position
            position = {
                'x': col * grid_spacing, 
                'y': row * grid_spacing
            }
            
            # Store position
            node_positions[table_id] = position
            
            columns = ColumnMetadata.objects.filter(table=table)
            column_info = []
            
            for column in columns:
                column_info.append({
                    'name': column.column_name,
                    'type': column.data_type,
                    'is_nullable': column.is_nullable,
                    'is_primary_key': column.is_primary_key,
                    'is_foreign_key': column.is_foreign_key,
                    'description': column.description if column.description else ""
                })
            
            # Create node
            nodes.append({
                "id": table_id,
                "type": "tableNode",
                "position": position,
                "data": {
                    "label": table.table_name,
                    "schema": table.schema_name,
                    "description": table.description if table.description else "",
                    "columns": column_info
                },
                "width": 220,
                "height": 40 + len(column_info) * 24  # Dynamic height based on number of columns
            })
        
        # Build edges (relationships)
        edges = []
        
        # Get relationships
        relationships = RelationshipMetadata.objects.filter(
            from_column__table__database_id=database_id
        )
        
        for rel in relationships:
            from_table = rel.from_column.table
            to_table = rel.to_column.table
            
            source_id = f"{from_table.schema_name}.{from_table.table_name}"
            target_id = f"{to_table.schema_name}.{to_table.table_name}"
            
            edge_id = f"e-{rel.from_column.id}-{rel.to_column.id}"
            
            edges.append({
                "id": edge_id,
                "source": source_id,
                "target": target_id,
                "animated": True,
                "style": {
                    "stroke": "#7C4DFF",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#7C4DFF"
                },
                "data": {
                    "from_column": rel.from_column.column_name,
                    "to_column": rel.to_column.column_name,
                    "relationship_type": rel.relationship_type,
                    "label": f"{rel.from_column.column_name} → {rel.to_column.column_name}"
                },
                "label": f"{rel.from_column.column_name} → {rel.to_column.column_name}"
            })
        
        # Create complete diagram data
        diagram_data = {
            "nodes": nodes,
            "edges": edges,
            "metadata": {
                "database_id": database_id,
                "generated_at": datetime.now().isoformat()
            }
        }
        
        # Store the diagram data in the database
        database = ClientDatabase.objects.get(id=database_id)
        
        # Update or create ER diagram
        diagram, created = ERDiagram.objects.update_or_create(
            database=database,
            defaults={"diagram_data": diagram_data}
        )
        
        return {
            "success": True,
            "diagram_data": diagram_data
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}