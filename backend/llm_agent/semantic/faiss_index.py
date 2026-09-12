"""
Persists and queries per-(database, model_version) FAISS indexes on local
disk. FAISS is the sole store of vector data in this application — the
Embedding model only ever stores metadata (which schema element, which model
version, dimension, checksum). Each model version owns its own index file,
never shared or overwritten by a later version — re-embedding always builds a
brand-new index, so rolling back to a previous model version needs no rebuild.
"""
import os

import numpy as np

try:
    import faiss
except ImportError:
    faiss = None

# backend/embeddings/faiss_indexes/{database_id}/{model_version_tag}.index
_INDEX_ROOT = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "embeddings", "faiss_indexes",
)


class FaissIndexUnavailable(Exception):
    """Raised when faiss isn't installed, or no index exists yet for a
    (database, model_version) pair — callers should treat this as a signal to
    fall back to keyword-only search, not as a hard failure."""


def _index_path(database_id, model_version_tag):
    directory = os.path.join(_INDEX_ROOT, str(database_id))
    return os.path.join(directory, f"{model_version_tag}.index")


def build_index(database_id, model_version_tag, ids, vectors, dimension):
    """
    Builds a brand-new FAISS index from scratch for (database_id,
    model_version_tag) and persists it to disk, using an IndexIDMap so search
    results map directly back to Embedding row IDs (no separate position
    tracking needed).
    """
    if faiss is None:
        raise FaissIndexUnavailable("faiss is not installed")

    directory = os.path.join(_INDEX_ROOT, str(database_id))
    os.makedirs(directory, exist_ok=True)

    index = faiss.IndexIDMap(faiss.IndexFlatIP(dimension))
    if len(ids):
        index.add_with_ids(
            np.asarray(vectors, dtype="float32"),
            np.asarray(ids, dtype="int64"),
        )
    faiss.write_index(index, _index_path(database_id, model_version_tag))
    return index


def load_index(database_id, model_version_tag):
    if faiss is None:
        raise FaissIndexUnavailable("faiss is not installed")

    path = _index_path(database_id, model_version_tag)
    if not os.path.isfile(path):
        raise FaissIndexUnavailable(
            f"No FAISS index found for database={database_id} model_version={model_version_tag}"
        )
    return faiss.read_index(path)


def search(database_id, model_version_tag, query_vector, top_k=10):
    """Returns a list of (embedding_id, score) tuples, best first. Raises
    FaissIndexUnavailable if faiss isn't installed or no index exists yet —
    callers should catch this and fall back to keyword search."""
    index = load_index(database_id, model_version_tag)
    query = np.asarray([query_vector], dtype="float32")
    scores, ids = index.search(query, top_k)

    results = []
    for embedding_id, score in zip(ids[0], scores[0]):
        if embedding_id == -1:
            continue
        results.append((int(embedding_id), float(score)))
    return results
