"""
Computes the Dynamic Semantic Relationship Graph: similarity-based edges
between a database's embedded schema elements, complementing the structural
(FK-based) ER diagram. Uses FAISS top-k neighbor search per element — never a
full O(n^2) pairwise similarity matrix.
"""
import logging

from llm_agent.models import Embedding, SemanticRelationship
from . import embedding_service, faiss_index

logger = logging.getLogger(__name__)

TOP_K_NEIGHBORS = 5
MIN_SIMILARITY = 0.5


def compute_semantic_graph(database_obj):
    """
    Rebuilds SemanticRelationship rows for this database under the currently
    active model version. Returns (created_count, message).
    """
    provider, version = embedding_service.get_active_provider()
    if provider is None:
        return 0, "No active embedding model version."

    embeddings = list(Embedding.objects.filter(database=database_obj, model_version=version))
    if not embeddings:
        return 0, "No embeddings for this database under the active model version yet — run update_embeddings first."

    try:
        faiss_index.load_index(database_obj.id, version.version_tag)
    except faiss_index.FaissIndexUnavailable as e:
        return 0, str(e)

    texts = []
    owners = []
    for embedding in embeddings:
        text = embedding_service.resolve_owner_text(embedding)
        if text is None:
            continue
        texts.append(text)
        owners.append(embedding)

    if not texts:
        return 0, "No resolvable schema elements to compute relationships for."

    vectors = provider.encode(texts)

    SemanticRelationship.objects.filter(database=database_obj, model_version=version).delete()

    created = 0
    seen_pairs = set()

    for i, embedding in enumerate(owners):
        hits = faiss_index.search(database_obj.id, version.version_tag, vectors[i], top_k=TOP_K_NEIGHBORS + 1)
        for neighbor_id, score in hits:
            if neighbor_id == embedding.id or score < MIN_SIMILARITY:
                continue

            pair_key = tuple(sorted([embedding.id, neighbor_id]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            try:
                neighbor = Embedding.objects.get(id=neighbor_id)
            except Embedding.DoesNotExist:
                continue

            SemanticRelationship.objects.create(
                database=database_obj,
                from_type=embedding.owner_type,
                from_id=embedding.owner_id,
                to_type=neighbor.owner_type,
                to_id=neighbor.owner_id,
                similarity_score=float(score),
                model_version=version,
            )
            created += 1

    return created, f"Computed {created} semantic relationships using model {version.version_tag}."
