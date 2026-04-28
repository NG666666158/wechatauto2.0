from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from wechat_ai import RetrievedChunk
from wechat_ai.rag.retriever import _normalize_metadata, load_index_chunks


_TOKEN_PATTERN = re.compile(r"[\w\u4e00-\u9fff]+", re.UNICODE)


@dataclass(frozen=True)
class KeywordRetriever:
    index_path: Path

    def retrieve(self, query: str, limit: int = 3) -> list[RetrievedChunk]:
        if limit <= 0:
            return []
        query_terms = _tokenize(query)
        if not query_terms:
            return []

        chunks = load_index_chunks(self.index_path)
        document_count = max(len(chunks), 1)
        document_frequency = _document_frequency(chunks)
        scored: list[RetrievedChunk] = []
        for chunk in chunks:
            text = str(chunk.get("text") or "")
            text_terms = _tokenize(text)
            if not text_terms:
                continue
            match_terms = sorted(set(query_terms).intersection(text_terms))
            if not match_terms:
                continue
            term_counts = {term: text_terms.count(term) for term in match_terms}
            score = sum(
                (term_counts[term] / (term_counts[term] + 1.2))
                * (math.log((document_count + 1) / (document_frequency.get(term, 0) + 1)) + 1.0)
                for term in match_terms
            )
            metadata = _normalize_metadata(chunk.get("metadata", {}))
            metadata["retriever"] = "keyword"
            metadata["match_terms"] = ",".join(match_terms)
            scored.append(RetrievedChunk(text=text, score=score, metadata=metadata))

        return sorted(scored, key=lambda chunk: chunk.score, reverse=True)[:limit]


def _document_frequency(chunks: list[dict[str, Any]]) -> dict[str, int]:
    frequency: dict[str, int] = {}
    for chunk in chunks:
        for term in set(_tokenize(str(chunk.get("text") or ""))):
            frequency[term] = frequency.get(term, 0) + 1
    return frequency


def _tokenize(text: str) -> list[str]:
    return [token.lower() for token in _TOKEN_PATTERN.findall(text) if token.strip()]
