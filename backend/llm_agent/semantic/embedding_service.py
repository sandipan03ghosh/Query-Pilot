"""
Real embedding generation, replacing the old MetadataVectorizer placeholder
(hardcoded [0.1, 0.2, 0.3]-style dummy vectors). Encodes table/column text
through the active EmbeddingProvider and writes vectors into a per-(database,
model_version) FAISS index — the Embedding model only stores metadata about
what was embedded, never the vector itself.
"""
import logging

from .embedding_provider import SentenceTransformerProvider
from . import faiss_index

logger = logging.getLogger(__name__)

# Lazily-loaded provider instances, keyed by version_tag, so the (potentially
# large) model is only loaded into memory once per process, on first use.
_provider_cache = {}


def get_active_model_version():
    from llm_agent.models import EmbeddingModelVersion
    return EmbeddingModelVersion.objects.filter(is_active=True).first()


def get_active_provider():
    """
    The single factory every embedding/retrieval consumer should use. Returns
    (provider, model_version) — both None if no model version is active yet,
    which callers must treat as "fall back to keyword-only search" rather
    than an error (see retrieval_service.py's fallback cascade).
    """
    version = get_active_model_version()
    if version is None:
        return None, None

    if version.version_tag not in _provider_cache:
        _provider_cache[version.version_tag] = SentenceTransformerProvider(
            version.model_path, model_id=version.version_tag
        )
    return _provider_cache[version.version_tag], version


def build_schema_text(name, schema_name=None, description=None, columns=None):
    """
    Linearizes a schema element into the fixed template used at both training
    (export_training_data.py) and inference time — must stay identical in
    both places, or the two embedding spaces aren't comparable.
    """
    parts = [f"table: {schema_name}.{name}" if schema_name else f"table: {name}"]
    if columns:
        parts.append(f"columns: {', '.join(columns)}")
    if description:
        parts.append(f"description: {description}")
    return " | ".join(parts)


def resolve_owner_text(embedding):
    """
    Rebuilds the same linearized text used to originally encode this
    Embedding row's schema element, given only its (owner_type, owner_id).
    Shared by semantic_graph.py and the embedding-projection API view — both
    need to re-encode existing embeddings without depending on FAISS's
    reconstruct() (unreliable for IndexIDMap-wrapped flat indexes across
    versions); re-encoding is a small extra pass, negligible at schema-catalog
    scale. Returns None if the underlying TableMetadata/ColumnMetadata row no
    longer exists.
    """
    from databases.models import TableMetadata, ColumnMetadata

    if embedding.owner_type == "table":
        try:
            table = TableMetadata.objects.get(id=embedding.owner_id)
        except TableMetadata.DoesNotExist:
            return None
        column_names = list(table.columns.values_list("column_name", flat=True))
        return build_schema_text(table.table_name, table.schema_name, table.description, column_names)

    try:
        column = ColumnMetadata.objects.select_related("table").get(id=embedding.owner_id)
    except ColumnMetadata.DoesNotExist:
        return None
    return build_schema_text(
        f"{column.table.table_name}.{column.column_name}", column.table.schema_name, column.description
    )


def update_all_embeddings(database_obj):
    """
    Real replacement for MetadataVectorizer.update_all_embeddings. Encodes
    every table/column belonging to `database_obj` under the currently active
    model version and rebuilds that (database, model_version) FAISS index
    from scratch. Returns a {success, message, ...} dict matching the shape
    the /update_embeddings/ endpoint has always returned.
    """
    from databases.models import TableMetadata
    from llm_agent.models import Embedding

    provider, version = get_active_provider()
    if provider is None:
        return {
            "success": False,
            "message": "No active embedding model version — import and activate one first.",
        }

    tables = list(TableMetadata.objects.filter(database=database_obj).prefetch_related("columns"))

    texts = []
    owners = []  # list of (owner_type, owner_id), same order as texts

    for table in tables:
        column_names = [c.column_name for c in table.columns.all()]
        texts.append(build_schema_text(table.table_name, table.schema_name, table.description, column_names))
        owners.append(("table", table.id))

        for column in table.columns.all():
            texts.append(build_schema_text(
                f"{table.table_name}.{column.column_name}", table.schema_name, column.description
            ))
            owners.append(("column", column.id))

    if not texts:
        return {"success": True, "message": "No tables/columns to embed for this database.", "embedded_count": 0}

    vectors = provider.encode(texts)

    # Re-embedding under the same model version replaces that version's rows for
    # this database (but never touches other model versions' rows/indexes).
    Embedding.objects.filter(database=database_obj, model_version=version).delete()

    embedding_rows = [
        Embedding(
            database=database_obj,
            owner_type=owner_type,
            owner_id=owner_id,
            model_version=version,
            dimension=provider.dimension,
            is_active=True,
        )
        for owner_type, owner_id in owners
    ]
    created = Embedding.objects.bulk_create(embedding_rows)
    ids = [row.id for row in created]

    faiss_index.build_index(database_obj.id, version.version_tag, ids, vectors, provider.dimension)

    logger.info(
        "Embedded %d schema elements for database_id=%s under model_version=%s",
        len(texts), database_obj.id, version.version_tag,
    )

    return {
        "success": True,
        "message": f"Embedded {len(texts)} schema elements using model {version.version_tag}.",
        "embedded_count": len(texts),
        "model_version": version.version_tag,
    }
