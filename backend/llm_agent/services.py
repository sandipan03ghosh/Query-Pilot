import hashlib
import logging

import sqlparse
from django.conf import settings
from dotenv import load_dotenv

from databases.models import TableMetadata, ColumnMetadata, RelationshipMetadata
from user.models import UserTokenUsage
from .llm_providers import get_provider

# load environment variables from .env file
load_dotenv()

# Prompt tokens are discounted by this factor against a user's quota (original behaviour).
INPUT_FACTOR = 10

def _prompt_fingerprint(prompt):
    """Non-reversible prompt id — correlates token-usage rows without persisting
    the schema, few-shot SQL, or sample values the prompt contains."""
    return "sha256:" + hashlib.sha256((prompt or "").encode("utf-8")).hexdigest()


def llm_api(prompt, model=None, temperature=0.0, max_tokens=1024, user=None,
            response_schema=None):
    """Thin wrapper over llm_providers.get_provider(): keeps the historical
    return shape and per-user token accounting, adds `response_schema` for
    structured output (result['parsed'])."""
    try:
        provider, resolved_model = get_provider(model)
    except RuntimeError as e:
        logging.error("LLM provider unavailable: %s", e)
        return {
            "success": False,
            "error": "No language model is configured.",
            "error_type": "api_key_error",
        }

    result = provider.generate(
        prompt,
        response_schema=response_schema,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    usage = result.get("token_usage") or {}
    if user is not None and usage.get("total_tokens"):
        try:
            UserTokenUsage.record_token_usage(
                user=user,
                prompt_tokens=int(usage.get("prompt_tokens", 0) / INPUT_FACTOR),
                completion_tokens=int(usage.get("completion_tokens", 0)),
                model=resolved_model,
                query_text=_prompt_fingerprint(prompt),  # fingerprint, never the prompt
            )
        except Exception:  # noqa: BLE001
            logging.exception("Failed to record token usage")

    return result

def get_metadata_description(metadata_type, name, sample_data=None, user=None):
    """
    Generate natural language descriptions for database metadata.
    
    Args:
        metadata_type (str): Type of metadata ('table', 'column', 'relationship')
        name (str): Name of the database object
        sample_data (dict, optional): Sample data or additional context
        user (User, optional): Django user to track token usage, default is None
        
    Returns:
        str: Generated description
    """
    # Base prompts without additional context
    base_prompts = {
        "table": f"Generate a brief, professional description for a database table named '{name}'.",
        "column": f"Generate a brief, professional description for a database column named '{name}'.",
        "relationship": f"Generate a brief, professional description for a database relationship."
    }
    
    if metadata_type not in base_prompts:
        return "Invalid metadata type specified."
    
    # Start with the base prompt
    prompt = base_prompts[metadata_type]
    
    # Add context details based on metadata type
    if sample_data:
        if metadata_type == 'table':
            schema = sample_data.get('schema', 'unknown')
            table_type = sample_data.get('table_type', 'table')
            row_count = sample_data.get('row_count', 'unknown')
            
            prompt += f"\n\nContext information:"
            prompt += f"\n- Schema: {schema}"
            prompt += f"\n- Table type: {table_type}"
            if row_count != 'unknown':
                prompt += f"\n- Approximate row count: {row_count}"
            
            # Add column information if available
            if 'columns' in sample_data:
                prompt += "\n- Columns:"
                for column in sample_data['columns'][:10]:  # Limit to 10 columns
                    col_name = column.get('name', '')
                    col_type = column.get('type', '')
                    is_pk = "primary key" if column.get('primary_key', False) else ""
                    is_fk = "foreign key" if column.get('foreign_key', False) else ""
                    
                    keys = ""
                    if is_pk and is_fk:
                        keys = " (primary and foreign key)"
                    elif is_pk:
                        keys = " (primary key)"
                    elif is_fk:
                        keys = " (foreign key)"
                        
                    prompt += f"\n  - {col_name}: {col_type}{keys}"
                    
        elif metadata_type == 'column':
            schema = sample_data.get('schema', 'unknown')
            table = sample_data.get('table', 'unknown')
            data_type = sample_data.get('data_type', 'unknown')
            nullable = "nullable" if sample_data.get('nullable', True) else "not nullable"
            
            prompt += f"\n\nContext information:"
            prompt += f"\n- Schema: {schema}"
            prompt += f"\n- Table: {table}"
            prompt += f"\n- Data type: {data_type}"
            prompt += f"\n- {nullable}"
            
            if sample_data.get('primary_key', False):
                prompt += "\n- This is a primary key column"
            
            if sample_data.get('foreign_key', False):
                prompt += "\n- This is a foreign key column"
            
            # Sample values are real row data — send only when
            # LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT permits, capped at 10, hints
            # only; the stored description stays value-free.
            allow_samples = bool(getattr(settings, "LLM_ALLOW_SAMPLE_VALUES_IN_PROMPT", False))
            if allow_samples and sample_data.get('sample_values'):
                capped = [f"'{str(v)}'" for v in list(sample_data['sample_values'])[:10]]
                prompt += f"\n\nA few example values (hints only, do not reproduce them): {', '.join(capped)}"
                prompt += (
                    "\n\nUse the column name, data type, constraints and these hints to "
                    "infer what the column represents. Do NOT quote, list, enumerate, or "
                    "reproduce any actual values in your description — describe the KIND of "
                    "data only (e.g. 'an order status', 'a two-letter country code')."
                )
        
        elif metadata_type == 'relationship':
            prompt += f"\n\nContext information: {sample_data}"
    
    # Request a concise professional description
    prompt += "\n\nGenerate a single paragraph, professional description that would be helpful for a database user to understand this item's purpose and content."
    
    # Pass the user parameter to track token usage
    result = llm_api(prompt=prompt, user=user, model="llama-3.1-70b-instant")
    if result.get("success"):
        return result.get("content", "")
    return "Failed to generate description due to API error."

def build_fk_edges(database_id, table_names=None):
    """Return foreign-key relationships as 'a.col -> b.col' strings, optionally
    restricted to edges touching `table_names`."""
    qs = (
        RelationshipMetadata.objects
        .filter(from_column__table__database_id=database_id)
        .select_related("from_column__table", "to_column__table")
    )
    edges = []
    for rel in qs:
        ft, tt = rel.from_column.table, rel.to_column.table
        if table_names is not None and ft.table_name not in table_names and tt.table_name not in table_names:
            continue
        edges.append(
            f"{ft.table_name}.{rel.from_column.column_name} -> "
            f"{tt.table_name}.{rel.to_column.column_name}"
        )
    return edges


def nl_to_sql(natural_language_query, database_id, user=None, *, enforce_owner=True,
              variant=False):
    """Translate a question into SQL via structured LLM output.

    variant=True asks for an independently-phrased second query (different join
    order / aggregation), at a higher temperature, for the multi-query
    hallucination check. Same return shape; used by llm_agent.verification.

    Authorization: the database must be owned by `user` unless enforce_owner=False
    (trusted internal callers, which do their own scoping).

    Returns one of:
      {success: True, sql_query, explanation, tables_used, columns_used,
       self_reported_confidence, used_retrieval, retrieved_tables}
      {success: True, needs_clarification: True, interpretations: [...]}
      {success: True, answerable: False, message, explanation}
      {success: False, error, error_type}

    sql_query is a CANDIDATE — not executed here; every execution path runs it
    through GuardrailPipeline + EXPLAIN first.
    """
    from databases.models import ClientDatabase
    from llm_agent.semantic.semantic_engine import build_schema_context
    from . import prompts

    if enforce_owner and user is None:
        return {"success": False, "error": "Authentication required.",
                "error_type": "not_authenticated"}

    lookup = {"id": database_id}
    if enforce_owner:
        lookup["owner"] = user
    try:
        database = ClientDatabase.objects.get(**lookup)
    except ClientDatabase.DoesNotExist:
        # Same response for wrong-id and not-owned — don't leak existence.
        return {"success": False, "error": "Database not found.",
                "error_type": "database_not_found"}

    try:
        schema, used_retrieval = build_schema_context(
            database, natural_language_query, build_schema_representation,
        )
    except Exception:  # noqa: BLE001
        logging.exception("build_schema_context failed")
        return {"success": False, "error": "Could not load the database schema.",
                "error_type": "schema_error"}

    if not schema:
        return {
            "success": False,
            "error": "No schema information for this database yet. Run 'Extract Schema' first.",
            "error_type": "metadata_not_extracted",
        }

    table_names = {t["table_name"] for t in schema}
    fk_edges = build_fk_edges(database_id, table_names)
    few_shot = get_rag_examples(natural_language_query, database_id=database_id)
    few_shot_count = len(few_shot)

    prompt = prompts.build_sql_generation_prompt(
        schema, fk_edges, few_shot, natural_language_query,
    )
    if variant:
        prompt += prompts.MULTI_QUERY_PROMPT_SUFFIX
    result = llm_api(
        prompt,
        user=user,
        model=getattr(settings, "SQL_GENERATION_MODEL", None),
        response_schema=prompts.SQL_GENERATION_SCHEMA,
        temperature=0.4 if variant else 0.0,
        max_tokens=1200,
    )
    if not result.get("success"):
        return {
            "success": False,
            "error": result.get("error", "SQL generation failed."),
            "error_type": result.get("error_type", "llm_api_error"),
        }

    data = result.get("parsed")
    if not isinstance(data, dict):
        return {
            "success": False,
            "error": "The model did not return a valid structured response.",
            "error_type": "generation_error",
        }

    if not data.get("is_answerable", True):
        return {
            "success": True,
            "answerable": False,
            "message": "This question can't be answered from the available schema.",
            "explanation": data.get("explanation", ""),
        }

    if data.get("is_ambiguous"):
        interpretations = [
            {
                "label": (i.get("label") or "").strip(),
                "sql": (i.get("sql") or "").strip(),
                "explanation": (i.get("explanation") or "").strip(),
            }
            for i in (data.get("interpretations") or [])
            if (i.get("sql") or "").strip()
        ]
        if interpretations:
            return {"success": True, "needs_clarification": True,
                    "interpretations": interpretations}
        # ambiguous but no usable options — fall through to plain SQL

    sql = (data.get("sql") or "").strip()
    if not sql:
        return {
            "success": False,
            "error": "The model returned no SQL for an answerable, unambiguous question.",
            "error_type": "generation_error",
        }
    # Tokenize check only — not PostgreSQL validation (that's Guardrails + EXPLAIN).
    if not sqlparse.parse(sql):
        return {"success": False,
                "error": "The generated response did not contain usable SQL.",
                "error_type": "generation_error"}

    return {
        "success": True,
        "sql_query": sql,
        "explanation": data.get("explanation", ""),
        "tables_used": data.get("tables_used") or [],
        "columns_used": data.get("columns_used") or [],
        "self_reported_confidence": data.get("self_reported_confidence"),
        "used_retrieval": used_retrieval,
        "retrieved_tables": sorted(table_names),
        "few_shot_count": few_shot_count,
    }

def build_schema_representation(database_id):
    """
    Build a representation of the database schema for the LLM based on extracted metadata.
    
    Args:
        database_id (int): The database ID
        
    Returns:
        list: Schema representation for the LLM
    """
    try:
        tables = TableMetadata.objects.filter(database_id=database_id)
        schema = []
        
        for table in tables:
            try:
                columns = ColumnMetadata.objects.filter(table=table)
                column_info = []
                
                for column in columns:
                    column_info.append({
                        'name': column.column_name,
                        'type': column.data_type,
                        'nullable': column.is_nullable,
                        'is_primary_key': column.is_primary_key,
                        'is_foreign_key': column.is_foreign_key,
                        'description': column.description if column.description else "",
                        'is_categorical': column.is_categorical,
                        'sample_values': column.sample_values or [],
                    })
                    
                schema.append({
                    'table_name': table.table_name,
                    'schema_name': table.schema_name,
                    'description': table.description if table.description else "",
                    'columns': column_info
                })
            except Exception as e:
                logging.error(f"Error processing table {table.table_name}: {str(e)}")
                continue
                
        if not schema:
            logging.warning(f"No schema information found for database ID {database_id}")
        
        return schema
        
    except Exception as e:
        logging.error(f"Error building schema representation: {str(e)}")
        return []

def get_rag_examples(query, database_id=None, top_k=5):
    """Up to `top_k` similar (question, sql) pairs for few-shot prompting.
    Returns [{"question", "sql"}]; [] is always valid (few-shot is optional).

    Phase B's query_examples.similar_examples MUST: (1) stay within
    `database_id`'s namespace, (2) index only owner-approved pairs, never raw
    history, (3) remain untrusted — text is fenced + _clean'd in the prompt and
    generated SQL still passes GuardrailPipeline + EXPLAIN.

    No-op returning [] until Phase B wires that module.
    """
    if not database_id:
        return []
    try:
        from llm_agent.semantic import query_examples
    except ImportError:
        return []
    try:
        examples = query_examples.similar_examples(database_id, query, top_k=top_k)
    except Exception:  # noqa: BLE001
        logging.exception("get_rag_examples failed; continuing without few-shot")
        return []
    return [
        {"question": e.get("question", ""), "sql": e.get("sql", "")}
        for e in (examples or [])
        if e.get("question") and e.get("sql")
    ]
