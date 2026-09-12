"""
The EmbeddingProvider abstraction. `sentence_transformers` is imported in
exactly this one file, inside SentenceTransformerProvider — every other
module in this codebase (embedding_service.py, retrieval_service.py,
artifact_validator.py, drift_service.py, ...) depends only on the
EmbeddingProvider interface below. Swapping the encoder (a different base
model, a hosted embedding API, an ONNX export) means changing only this file.
"""
from abc import ABC, abstractmethod


class EmbeddingProvider(ABC):
    @property
    @abstractmethod
    def dimension(self):
        """Vector dimension this provider produces."""

    @property
    @abstractmethod
    def model_id(self):
        """Identifier for the underlying model (e.g. an EmbeddingModelVersion.version_tag)."""

    @abstractmethod
    def encode(self, texts):
        """
        Encode a list of strings into a list/array of L2-normalized float
        vectors of length `dimension`, in the same order as `texts`.
        """


class SentenceTransformerProvider(EmbeddingProvider):
    """The only class in this codebase that imports sentence_transformers."""

    def __init__(self, model_path, model_id=None):
        from sentence_transformers import SentenceTransformer  # local import: keep this the sole import site

        self._model = SentenceTransformer(model_path)
        self._dimension = self._model.get_sentence_embedding_dimension()
        self._model_id = model_id or model_path

    @property
    def dimension(self):
        return self._dimension

    @property
    def model_id(self):
        return self._model_id

    def encode(self, texts):
        return self._model.encode(list(texts), normalize_embeddings=True, convert_to_numpy=True)
