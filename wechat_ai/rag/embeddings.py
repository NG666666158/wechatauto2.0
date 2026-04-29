from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from urllib import error, request

from wechat_ai.config import EmbeddingSettings


class BaseEmbeddings:
    provider_name: str | None = None
    embedding_trusted: bool = False

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    def embed_query(self, text: str) -> list[float]:
        raise NotImplementedError


FAKE_EMBEDDING_PROVIDER = "FakeEmbeddings"
TRUSTED_LOCAL_EMBEDDING_PROVIDER = "TrustedLocalEmbeddings"
OPENAI_COMPATIBLE_EMBEDDING_PROVIDER = "OpenAICompatibleEmbeddings"
EmbeddingTransport = Callable[[str, dict[str, Any], dict[str, str], float], Mapping[str, Any]]


@dataclass(frozen=True)
class EmbeddingProviderInfo:
    provider: str | None = None
    trusted: bool = False

    @classmethod
    def from_index_payload(cls, payload: Mapping[str, object]) -> "EmbeddingProviderInfo":
        provider = _normalize_provider(payload.get("embedding_provider"))
        trusted = payload.get("embedding_trusted") is True
        if provider == FAKE_EMBEDDING_PROVIDER:
            trusted = False
        if not provider:
            trusted = False
        return cls(provider=provider, trusted=trusted)

    @property
    def uses_fake_embeddings(self) -> bool:
        return self.provider == FAKE_EMBEDDING_PROVIDER

    @property
    def trust_status(self) -> str:
        if self.uses_fake_embeddings:
            return "fake"
        if self.trusted:
            return "trusted"
        if self.provider:
            return "untrusted"
        return "unknown"

    @property
    def trust_reason(self) -> str:
        if self.uses_fake_embeddings:
            return "fake_embedding_provider"
        if self.trusted:
            return ""
        if self.provider:
            return "embedding_trust_not_declared"
        return "embedding_provider_missing"


@dataclass(frozen=True)
class FakeEmbeddings(BaseEmbeddings):
    dimensions: int = 8
    provider_name: str = FAKE_EMBEDDING_PROVIDER
    embedding_trusted: bool = False

    def __post_init__(self) -> None:
        if self.dimensions <= 0:
            raise ValueError("dimensions must be positive")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_text(text)

    def _embed_text(self, text: str) -> list[float]:
        digest = hashlib.sha256(text.encode("utf-8")).digest()
        values: list[float] = []
        for index in range(self.dimensions):
            byte = digest[index % len(digest)]
            values.append(round(byte / 255.0, 6))
        return values


@dataclass(frozen=True)
class TrustedLocalEmbeddings(BaseEmbeddings):
    dimensions: int = 8
    provider_name: str = TRUSTED_LOCAL_EMBEDDING_PROVIDER
    embedding_trusted: bool = True

    def __post_init__(self) -> None:
        if self.dimensions <= 0:
            raise ValueError("dimensions must be positive")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed_text(text)

    def _embed_text(self, text: str) -> list[float]:
        digest = hashlib.sha256(f"trusted-local:{text}".encode("utf-8")).digest()
        values: list[float] = []
        for index in range(self.dimensions):
            byte = digest[index % len(digest)]
            values.append(round(byte / 255.0, 6))
        return values


@dataclass(frozen=True)
class OpenAICompatibleEmbeddings(BaseEmbeddings):
    base_url: str
    api_key: str
    model: str = "text-embedding-3-small"
    timeout: float = 30.0
    dimensions: int | None = None
    transport: EmbeddingTransport | None = None
    provider_name: str = OPENAI_COMPATIBLE_EMBEDDING_PROVIDER
    embedding_trusted: bool = True

    def __post_init__(self) -> None:
        if not self.base_url.strip():
            raise ValueError("base_url is required")
        if not self.api_key.strip():
            raise ValueError("api_key is required")
        if not self.model.strip():
            raise ValueError("model is required")
        if self.timeout <= 0:
            raise ValueError("timeout must be positive")
        if self.dimensions is not None and self.dimensions <= 0:
            raise ValueError("dimensions must be positive")

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return self._embed(texts)

    def embed_query(self, text: str) -> list[float]:
        vectors = self._embed([text])
        return vectors[0]

    def _embed(self, texts: list[str]) -> list[list[float]]:
        payload: dict[str, Any] = {
            "model": self.model,
            "input": texts,
        }
        if self.dimensions is not None:
            payload["dimensions"] = self.dimensions

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        response = (self.transport or _post_json)(self._embeddings_url(), payload, headers, float(self.timeout))
        return self._parse_vectors(response, expected_count=len(texts))

    def _embeddings_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/embeddings"

    def _parse_vectors(self, response: Mapping[str, Any], *, expected_count: int) -> list[list[float]]:
        raw_items = response.get("data")
        if not isinstance(raw_items, list):
            raise ValueError("Embedding response missing data list")

        items = sorted(
            enumerate(raw_items),
            key=lambda pair: _response_index(pair[1], fallback=pair[0]),
        )
        vectors = [self._parse_vector(item) for _, item in items]
        if len(vectors) != expected_count:
            raise ValueError(f"Embedding response returned {len(vectors)} vectors, expected {expected_count}")
        return vectors

    def _parse_vector(self, item: object) -> list[float]:
        if not isinstance(item, Mapping):
            raise ValueError("Embedding response item must be an object")
        raw_vector = item.get("embedding")
        if not isinstance(raw_vector, list) or not raw_vector:
            raise ValueError("Embedding response item missing embedding vector")

        vector: list[float] = []
        for value in raw_vector:
            if not isinstance(value, (int, float)):
                raise ValueError("Embedding vector values must be numeric")
            vector.append(float(value))

        if self.dimensions is not None and len(vector) != self.dimensions:
            raise ValueError(f"Embedding vector has {len(vector)} dimensions, expected {self.dimensions}")
        return vector


def build_embeddings(settings: EmbeddingSettings | None = None) -> BaseEmbeddings:
    resolved_settings = settings or EmbeddingSettings.from_env()
    if resolved_settings.provider == "fake":
        return FakeEmbeddings()
    if resolved_settings.provider == "trusted_local":
        return TrustedLocalEmbeddings()
    if resolved_settings.provider == "openai_compatible":
        return OpenAICompatibleEmbeddings(
            base_url=resolved_settings.base_url,
            api_key=resolved_settings.api_key,
            model=resolved_settings.model,
            timeout=resolved_settings.timeout,
            dimensions=resolved_settings.dimensions,
        )
    raise ValueError(f"Unsupported embedding provider '{resolved_settings.provider}'")


def embedding_provider_info(embeddings: BaseEmbeddings) -> EmbeddingProviderInfo:
    provider = _normalize_provider(getattr(embeddings, "provider_name", None)) or embeddings.__class__.__name__
    trusted = bool(getattr(embeddings, "embedding_trusted", False))
    return EmbeddingProviderInfo.from_index_payload(
        {
            "embedding_provider": provider,
            "embedding_trusted": trusted,
        }
    )


def _normalize_provider(value: object) -> str | None:
    if value is None:
        return None
    provider = str(value).strip()
    return provider or None


def _response_index(item: object, *, fallback: int) -> int:
    if not isinstance(item, Mapping):
        return fallback
    raw_index = item.get("index")
    return raw_index if isinstance(raw_index, int) else fallback


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> Mapping[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    http_request = request.Request(url, data=data, headers=headers, method="POST")
    try:
        with request.urlopen(http_request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Embedding request failed with HTTP {exc.code}: {detail}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Embedding request failed: {exc.reason}") from exc

    try:
        decoded = json.loads(body)
    except json.JSONDecodeError as exc:
        raise ValueError("Embedding response was not valid JSON") from exc
    if not isinstance(decoded, Mapping):
        raise ValueError("Embedding response must be a JSON object")
    return decoded
