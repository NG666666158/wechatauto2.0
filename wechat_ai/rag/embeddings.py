from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Mapping


class BaseEmbeddings:
    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError

    def embed_query(self, text: str) -> list[float]:
        raise NotImplementedError


FAKE_EMBEDDING_PROVIDER = "FakeEmbeddings"


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


@dataclass(frozen=True)
class FakeEmbeddings(BaseEmbeddings):
    dimensions: int = 8

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


def _normalize_provider(value: object) -> str | None:
    if value is None:
        return None
    provider = str(value).strip()
    return provider or None
