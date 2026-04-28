from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping

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


def build_embeddings(settings: EmbeddingSettings | None = None) -> BaseEmbeddings:
    resolved_settings = settings or EmbeddingSettings.from_env()
    if resolved_settings.provider == "fake":
        return FakeEmbeddings()
    if resolved_settings.provider == "trusted_local":
        return TrustedLocalEmbeddings()
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
