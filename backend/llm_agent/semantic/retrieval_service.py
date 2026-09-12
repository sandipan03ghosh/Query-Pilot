"""
Hybrid retrieval, replacing MetadataVectorizer.search_metadata's old pure-
keyword placeholder. Implements the fallback cascade so the system never
hard-fails just because embeddings are unavailable:

    hybrid (vector + keyword)
        -> keyword-only, if no active model / no FAISS index yet
        -> (the /search/ endpoint's contract is unchanged either way)
"""
import logging

from databases.models import TableMetadata, ColumnMetadata
from . import embedding_service, faiss_index

logger = logging.getLogger(__name__)

VECTOR_WEIGHT = 0.6
KEYWORD_WEIGHT = 0.4


def _keyword_score(query_text, name, description=None, extra=None):
    score = 0
    q = query_text.lower()
    if name and q in name.lower():
        score += 5
    if description and q in description.lower():
        score += 3
    if extra and q in extra.lower():
        score += 1
    return score


def _keyword_search(database_obj, query_text, limit=10):
    """The original keyword-substring search — also used standalone as the
    fallback tier when vector search is unavailable."""
    results = []

    for table in TableMetadata.objects.filter(database=database_obj):
        score = _keyword_score(query_text, table.table_name, table.description)
        if score > 0:
            results.append({
                "type": "table", "id": table.id, "name": table.table_name,
                "schema": table.schema_name, "description": table.description,
                "score": score,
            })

    for column in ColumnMetadata.objects.filter(table__database=database_obj).select_related("table"):
        score = _keyword_score(query_text, column.column_name, column.description, column.data_type)
        if score > 0:
            results.append({
                "type": "column", "id": column.id, "name": column.column_name,
                "schema": column.table.schema_name, "description": column.description,
                "data_type": column.data_type, "score": score,
            })

    results.sort(key=lambda r: r["score"], reverse=True)
    return results[:limit]


def _resolve_owner(owner_type, owner_id):
    if owner_type == "table":
        try:
            table = TableMetadata.objects.get(id=owner_id)
        except TableMetadata.DoesNotExist:
            return None
        return {
            "type": "table", "id": table.id, "name": table.table_name,
            "schema": table.schema_name, "description": table.description,
        }

    try:
        column = ColumnMetadata.objects.select_related("table").get(id=owner_id)
    except ColumnMetadata.DoesNotExist:
        return None
    return {
        "type": "column", "id": column.id, "name": column.column_name,
        "schema": column.table.schema_name, "description": column.description,
        "data_type": column.data_type,
    }


def search_metadata(database_obj, query_text, limit=10, mode="hybrid"):
    """
    Replacement for MetadataVectorizer.search_metadata. Same response shape
    as before ({type, id, name, schema, description, score}), with an
    additive `explanation` field. `mode` is optional and defaults to the
    fallback-aware "hybrid" behavior — old callers that don't pass it keep
    working unchanged.
    """
    if mode == "keyword":
        return _keyword_search(database_obj, query_text, limit)

    provider, version = embedding_service.get_active_provider()
    if provider is None:
        logger.info("No active embedding model version — falling back to keyword-only search.")
        return _keyword_search(database_obj, query_text, limit)

    try:
        query_vector = provider.encode([query_text])[0]
        vector_hits = faiss_index.search(database_obj.id, version.version_tag, query_vector, top_k=limit * 3)
    except faiss_index.FaissIndexUnavailable as e:
        logger.info("FAISS index unavailable (%s) — falling back to keyword-only search.", e)
        return _keyword_search(database_obj, query_text, limit)

    if mode == "vector":
        results = []
        for embedding_id, score in vector_hits:
            owner = _resolve_owner_from_embedding(embedding_id)
            if owner:
                owner["score"] = score
                owner["explanation"] = {"vector_similarity": score, "model_version": version.version_tag}
                results.append(owner)
        return results[:limit]

    # hybrid: fuse vector similarity with keyword score
    keyword_results = {(r["type"], r["id"]): r for r in _keyword_search(database_obj, query_text, limit=limit * 3)}
    fused = {}

    for embedding_id, vector_score in vector_hits:
        owner = _resolve_owner_from_embedding(embedding_id)
        if not owner:
            continue
        key = (owner["type"], owner["id"])
        keyword_entry = keyword_results.get(key)
        keyword_score = keyword_entry["score"] if keyword_entry else 0
        owner["score"] = VECTOR_WEIGHT * vector_score + KEYWORD_WEIGHT * keyword_score
        owner["explanation"] = {
            "vector_similarity": vector_score,
            "keyword_score": keyword_score,
            "model_version": version.version_tag,
            "matched_terms": [query_text] if keyword_score else [],
        }
        fused[key] = owner

    # Include pure-keyword matches vector search didn't surface, at a reduced weight
    for key, entry in keyword_results.items():
        if key not in fused:
            entry = dict(entry)
            keyword_score = entry["score"]
            entry["score"] = KEYWORD_WEIGHT * keyword_score
            entry["explanation"] = {
                "vector_similarity": 0,
                "keyword_score": keyword_score,
                "model_version": version.version_tag,
                "matched_terms": [query_text],
            }
            fused[key] = entry

    results = sorted(fused.values(), key=lambda r: r["score"], reverse=True)
    return results[:limit]


def _resolve_owner_from_embedding(embedding_id):
    from llm_agent.models import Embedding
    try:
        embedding = Embedding.objects.get(id=embedding_id)
    except Embedding.DoesNotExist:
        return None
    return _resolve_owner(embedding.owner_type, embedding.owner_id)
