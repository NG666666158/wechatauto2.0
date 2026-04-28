from __future__ import annotations

from dataclasses import dataclass

from wechat_ai import RetrievedChunk


@dataclass(frozen=True)
class HybridRetriever:
    dense_retriever: object
    keyword_retriever: object
    dense_weight: float = 0.6
    keyword_weight: float = 0.4

    def retrieve(self, query: str, limit: int = 3) -> list[RetrievedChunk]:
        if limit <= 0:
            return []

        dense_chunks = _retrieve(self.dense_retriever, query, limit)
        keyword_chunks = _retrieve(self.keyword_retriever, query, limit)
        dense_scores = _normalize_scores(dense_chunks)
        keyword_scores = _normalize_scores(keyword_chunks)

        merged: dict[str, dict[str, object]] = {}
        for source, chunks, normalized in (
            ("dense", dense_chunks, dense_scores),
            ("keyword", keyword_chunks, keyword_scores),
        ):
            for chunk in chunks:
                key = _chunk_key(chunk)
                entry = merged.setdefault(
                    key,
                    {
                        "chunk": chunk,
                        "sources": set(),
                        "dense_score": 0.0,
                        "keyword_score": 0.0,
                    },
                )
                entry["sources"].add(source)  # type: ignore[union-attr]
                entry[f"{source}_score"] = max(float(entry[f"{source}_score"]), normalized.get(key, 0.0))

        ranked: list[RetrievedChunk] = []
        for entry in merged.values():
            chunk = entry["chunk"]
            if not isinstance(chunk, RetrievedChunk):
                continue
            dense_score = float(entry["dense_score"])
            keyword_score = float(entry["keyword_score"])
            sources = sorted(str(source) for source in entry["sources"])  # type: ignore[union-attr]
            metadata = dict(chunk.metadata)
            metadata["retrieval_sources"] = ",".join(sources)
            metadata["dense_score"] = f"{dense_score:.6f}"
            metadata["keyword_score"] = f"{keyword_score:.6f}"
            ranked.append(
                RetrievedChunk(
                    text=chunk.text,
                    score=(dense_score * self.dense_weight) + (keyword_score * self.keyword_weight),
                    metadata=metadata,
                )
            )

        return sorted(ranked, key=lambda chunk: chunk.score, reverse=True)[:limit]


def _retrieve(retriever: object, query: str, limit: int) -> list[RetrievedChunk]:
    retrieve = getattr(retriever, "retrieve", None)
    if not callable(retrieve):
        return []
    return [chunk for chunk in retrieve(query, limit=limit) if isinstance(chunk, RetrievedChunk)]


def _normalize_scores(chunks: list[RetrievedChunk]) -> dict[str, float]:
    if not chunks:
        return {}
    raw_scores = [max(float(chunk.score), 0.0) for chunk in chunks]
    max_score = max(raw_scores)
    if max_score <= 0.0:
        return {_chunk_key(chunk): 0.0 for chunk in chunks}
    return {_chunk_key(chunk): max(float(chunk.score), 0.0) / max_score for chunk in chunks}


def _chunk_key(chunk: RetrievedChunk) -> str:
    metadata = chunk.metadata
    chunk_id = str(metadata.get("chunk_id") or metadata.get("source_id") or "").strip()
    if chunk_id:
        return f"id:{chunk_id}"
    doc_id = str(metadata.get("doc_id") or "").strip()
    chunk_index = str(metadata.get("chunk_index") or "").strip()
    if doc_id or chunk_index:
        return f"doc:{doc_id}:{chunk_index}"
    return f"text:{chunk.text}"
