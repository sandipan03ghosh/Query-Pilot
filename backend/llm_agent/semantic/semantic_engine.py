"""
Semantic Learning Engine: gives nl_to_sql a focused schema subset instead of the
whole extracted schema.

Path taken:
  active embedding model + FAISS index -> vector retrieval
  otherwise                            -> keyword relevance filter
  nothing matches / tiny schema / any error -> full dump (always safe)

Every path returns (schema, used_retrieval) with shape list of
{table_name, schema_name, description, columns:[...]}. Every returned table is
verified to belong to `database_obj` — this module trusts neither the FAISS
index nor build_schema_fn: _scoped_full_schema cross-checks against
TableMetadata and the vector path checks each embedding / row. Tables are keyed
by (schema_name, table_name) since one database can hold same-named tables in
different schemas.
"""
import logging
import re

from databases.models import TableMetadata, ColumnMetadata, RelationshipMetadata
from llm_agent.models import Embedding
from . import embedding_service, faiss_index

logger = logging.getLogger(__name__)

TOP_K_TABLES = 8

_STOPWORDS = {
    "the", "a", "an", "of", "in", "on", "for", "to", "and", "or", "by", "with",
    "how", "many", "much", "what", "which", "who", "show", "me", "list", "all",
    "count", "number", "total", "sum", "avg", "average", "get", "find", "give",
    "per", "each", "top", "most", "least", "is", "are", "was", "were", "from",
}


def _tokens(text):
    return {
        t for t in re.split(r"[^a-z0-9]+", (text or "").lower())
        if len(t) > 2 and t not in _STOPWORDS
    }


def _key(table_dict_or_obj):
    if isinstance(table_dict_or_obj, dict):
        return (table_dict_or_obj.get("schema_name"), table_dict_or_obj.get("table_name"))
    return (table_dict_or_obj.schema_name, table_dict_or_obj.table_name)


def _column_dict(column):
    return {
        "name": column.column_name,
        "type": column.data_type,
        "nullable": column.is_nullable,
        "is_primary_key": column.is_primary_key,
        "is_foreign_key": column.is_foreign_key,
        "description": column.description or "",
        "is_categorical": column.is_categorical,
        "sample_values": column.sample_values or [],
    }


def _table_dict(table):
    return {
        "table_name": table.table_name,
        "schema_name": table.schema_name,
        "description": table.description or "",
        "columns": [_column_dict(c) for c in table.columns.all()],
    }


def _scoped_full_schema(database_obj, build_schema_fn):
    """Call build_schema_fn, dropping anything not a real table of this database."""
    raw = build_schema_fn(database_obj.id) or []
    valid = set(
        TableMetadata.objects.filter(database=database_obj)
        .values_list("schema_name", "table_name")
    )
    scoped = [t for t in raw if _key(t) in valid]
    if len(scoped) != len(raw):
        logger.warning(
            "build_schema_fn returned %d rows outside database %s — dropped.",
            len(raw) - len(scoped), database_obj.id,
        )
    return scoped


def _fk_neighbours(database_id, table_keys):
    """Keys of tables directly FK-connected to `table_keys` (both endpoints scoped
    to this database)."""
    neighbours = set()
    try:
        edges = RelationshipMetadata.objects.filter(
            from_column__table__database_id=database_id,
            to_column__table__database_id=database_id,
        ).select_related("from_column__table", "to_column__table")
        for edge in edges:
            a = _key(edge.from_column.table)
            b = _key(edge.to_column.table)
            if a in table_keys:
                neighbours.add(b)
            if b in table_keys:
                neighbours.add(a)
    except Exception:  # noqa: BLE001
        logger.warning("FK-neighbour lookup failed for database_id=%s", database_id, exc_info=True)
    return neighbours


def _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn):
    """Rank tables by keyword overlap, keep the top ones plus FK neighbours,
    capped at TOP_K_TABLES. Falls back to the scoped full dump when nothing
    scores or the schema is already small."""
    full = _scoped_full_schema(database_obj, build_schema_fn)
    if len(full) <= TOP_K_TABLES:
        return full, False

    q_tokens = _tokens(natural_language_query)
    if not q_tokens:
        return full, False

    scored = []
    for table in full:
        haystack = _tokens(table.get("table_name")) | _tokens(table.get("description"))
        for col in table.get("columns", []):
            haystack |= _tokens(col.get("name"))
        score = len(q_tokens & haystack)
        if score:
            scored.append((score, table))

    if len(scored) < 2:
        return full, False

    scored.sort(key=lambda s: s[0], reverse=True)
    ordered_keys = [_key(t) for _s, t in scored]

    primary = ordered_keys[: max(2, TOP_K_TABLES - 2)]
    keep_order = list(primary)
    for k in _fk_neighbours(database_obj.id, set(primary)):
        if k not in keep_order:
            keep_order.append(k)
    for k in ordered_keys:
        if k not in keep_order:
            keep_order.append(k)
    keep_order = keep_order[:TOP_K_TABLES]

    by_key = {_key(t): t for t in full}
    filtered = [by_key[k] for k in keep_order if k in by_key]
    logger.info(
        "Keyword-filtered schema: %d/%d tables for database_id=%s",
        len(filtered), len(full), database_obj.id,
    )
    return (filtered or full), bool(filtered)


def build_schema_context(database_obj, natural_language_query, build_schema_fn):
    """Returns (schema, used_retrieval). See module docstring for path selection."""
    provider, version = embedding_service.get_active_provider()
    if provider is None:
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)

    try:
        query_vector = provider.encode([natural_language_query])[0]
        hits = faiss_index.search(
            database_obj.id, version.version_tag, query_vector, top_k=TOP_K_TABLES * 4,
        )
    except faiss_index.FaissIndexUnavailable:
        logger.info(
            "No FAISS index for database_id=%s model_version=%s — keyword filter.",
            database_obj.id, version.version_tag,
        )
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)
    except Exception:  # noqa: BLE001
        logger.warning("Vector retrieval failed for database_id=%s — keyword filter.",
                       database_obj.id, exc_info=True)
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)

    if not hits:
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)

    # Resolve FAISS ids -> table ids; every embedding and row must belong to THIS database.
    relevant_table_ids = []
    seen = set()
    for embedding_id, _score in hits:
        try:
            embedding = Embedding.objects.get(id=embedding_id)
        except Embedding.DoesNotExist:
            continue
        if embedding.database_id != database_obj.id:
            logger.warning(
                "FAISS embedding %s resolved to database %s, expected %s — skipping.",
                embedding_id, embedding.database_id, database_obj.id,
            )
            continue

        if embedding.owner_type == "table":
            table_id = embedding.owner_id
        elif embedding.owner_type == "column":
            table_id = (
                ColumnMetadata.objects
                .filter(id=embedding.owner_id, table__database_id=database_obj.id)
                .values_list("table_id", flat=True)
                .first()
            )
            if table_id is None:
                continue
        else:
            logger.warning(
                "Embedding %s has unexpected owner_type %r — skipping.",
                embedding_id, embedding.owner_type,
            )
            continue

        if table_id not in seen:
            seen.add(table_id)
            relevant_table_ids.append(table_id)
        if len(relevant_table_ids) >= TOP_K_TABLES:
            break

    if not relevant_table_ids:
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)

    tables = (
        TableMetadata.objects
        .filter(id__in=relevant_table_ids, database_id=database_obj.id)
        .prefetch_related("columns")
    )
    schema = [_table_dict(t) for t in tables]
    if not schema:
        return _keyword_filtered_schema(database_obj, natural_language_query, build_schema_fn)

    total_tables = TableMetadata.objects.filter(database=database_obj).count()
    logger.info(
        "Vector-retrieved schema: %d/%d tables for database_id=%s (model_version=%s)",
        len(schema), total_tables, database_obj.id, version.version_tag,
    )
    return schema, True
