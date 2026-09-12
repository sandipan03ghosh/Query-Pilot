"""
Validates a Colab-exported model artifact before it's ever allowed to become
an EmbeddingModelVersion row. A corrupted or incomplete artifact must never
reach the database, let alone be activated — every check below runs in order
and raises on the first failure, before anything is written.

Trust boundary: validate_artifact()/SentenceTransformerProvider() here are
only ever invoked from the `import_model_version` management command (CLI,
requires server/shell access) — never from an HTTP-facing view. `model_dir`
must never be accepted as a request parameter anywhere in this app.
"""
import hashlib
import json
import os
import sys

REQUIRED_MANIFEST_FIELDS = [
    "model_name", "base_model", "embedding_dimension",
    "python_version", "torch_version", "sentence_transformers_version",
    "transformers_version", "weights_sha256",
]

_WEIGHTS_FILENAMES = ("model.safetensors", "pytorch_model.bin")


class ArtifactValidationError(Exception):
    pass


def _find_file(model_dir, filenames):
    for root, _dirs, files in os.walk(model_dir):
        for name in filenames:
            if name in files:
                return os.path.join(root, name)
    return None


def _sha256_of(path):
    sha256 = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            sha256.update(chunk)
    return sha256.hexdigest()


def _major_minor(version_string):
    parts = str(version_string).split(".")
    return ".".join(parts[:2])


def validate_artifact(model_dir):
    """
    Runs every artifact check (files present, checksum, dimension smoke-test,
    framework/library version compatibility) and returns (manifest, provider)
    on success. Raises ArtifactValidationError with a clear reason otherwise.
    """
    if not os.path.isdir(model_dir):
        raise ArtifactValidationError(f"Model directory not found: {model_dir}")

    manifest_path = os.path.join(model_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        raise ArtifactValidationError("manifest.json is missing from the model directory")

    with open(manifest_path, "r", encoding="utf-8") as f:
        try:
            manifest = json.load(f)
        except json.JSONDecodeError as e:
            raise ArtifactValidationError(f"manifest.json is not valid JSON: {e}")

    missing = [field for field in REQUIRED_MANIFEST_FIELDS if field not in manifest]
    if missing:
        raise ArtifactValidationError(f"manifest.json is missing required fields: {', '.join(missing)}")

    weights_file = _find_file(model_dir, _WEIGHTS_FILENAMES)
    if not weights_file:
        raise ArtifactValidationError(
            f"No model weights file found (expected one of: {', '.join(_WEIGHTS_FILENAMES)})"
        )

    tokenizer_present = any(
        name.startswith("tokenizer") for _root, _dirs, files in os.walk(model_dir) for name in files
    )
    if not tokenizer_present:
        raise ArtifactValidationError("No tokenizer files found in the model directory")

    # 1. Checksum
    actual_checksum = _sha256_of(weights_file)
    if actual_checksum != manifest["weights_sha256"]:
        raise ArtifactValidationError(
            "Checksum mismatch — the weights file does not match manifest.json. "
            "The artifact may be corrupted or was modified after export."
        )

    # 2. Dimension smoke-test — actually load the model and encode something
    from .embedding_provider import SentenceTransformerProvider

    try:
        provider = SentenceTransformerProvider(model_dir, model_id=manifest["model_name"])
    except Exception as e:
        raise ArtifactValidationError(f"Failed to load the model for a smoke test: {e}")

    if provider.dimension != manifest["embedding_dimension"]:
        raise ArtifactValidationError(
            f"Dimension mismatch: manifest says {manifest['embedding_dimension']}, "
            f"but the loaded model actually produces {provider.dimension}-dimensional vectors."
        )

    # 3. Framework/library version compatibility (major.minor only — patch drift is fine)
    import torch
    import transformers
    import sentence_transformers

    installed = {
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "torch_version": torch.__version__,
        "transformers_version": transformers.__version__,
        "sentence_transformers_version": sentence_transformers.__version__,
    }
    mismatches = []
    for key, installed_value in installed.items():
        manifest_value = manifest.get(key)
        if manifest_value and _major_minor(manifest_value) != _major_minor(installed_value):
            mismatches.append(f"{key}: manifest={manifest_value} installed={installed_value}")
    if mismatches:
        raise ArtifactValidationError(
            "Framework/library version mismatch between training (Colab) and this environment: "
            + "; ".join(mismatches)
        )

    return manifest, provider
