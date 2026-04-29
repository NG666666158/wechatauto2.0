from __future__ import annotations

from typing import Any, Mapping


def build_compact_knowledge_evidence(results: list[Mapping[str, Any]], *, limit: int = 3, text_limit: int = 240) -> list[dict[str, Any]]:
    compact: list[dict[str, Any]] = []
    for item in results[: max(0, limit)]:
        metadata = item.get("metadata") if isinstance(item.get("metadata"), Mapping) else {}
        row = {
            "doc_id": _first_text(item.get("doc_id"), metadata.get("doc_id")),
            "source": _first_text(item.get("source"), metadata.get("source")),
            "chunk_index": _first_text(item.get("chunk_index"), metadata.get("chunk_index")),
            "text": _clip_text(item.get("text"), limit=text_limit),
            "score": _optional_float(item.get("score")),
            "knowledge_trust_status": str(item.get("embedding_trust_status") or "unknown").strip() or "unknown",
            "knowledge_trust_reason": str(item.get("embedding_trust_reason") or "").strip(),
        }
        compact.append(row)
    return compact


def build_knowledge_evidence(metadata: Mapping[str, Any]) -> dict[str, Any]:
    retrieval_sources = _split_evidence_list(metadata.get("retrieval_sources"))
    match_terms = _split_evidence_list(metadata.get("match_terms"))
    dense_score = _optional_float(metadata.get("dense_score"))
    keyword_score = _optional_float(metadata.get("keyword_score"))
    evidence: dict[str, Any] = {
        "metadata": dict(metadata),
        "retrieval_sources": retrieval_sources,
        "dense_score": dense_score,
        "keyword_score": keyword_score,
        "match_terms": match_terms,
        "doc_id": str(metadata.get("doc_id") or "").strip(),
        "source": str(metadata.get("source") or "").strip(),
        "chunk_index": str(metadata.get("chunk_index") or "").strip(),
    }
    return {
        "evidence": evidence,
        "retrieval_sources": retrieval_sources,
        "dense_score": dense_score,
        "keyword_score": keyword_score,
        "match_terms": match_terms,
        "doc_id": evidence["doc_id"],
        "source": evidence["source"],
        "chunk_index": evidence["chunk_index"],
    }


def build_knowledge_trust_metadata(*, provider: object, trusted: object, trust_status: str, trust_reason: str) -> dict[str, Any]:
    return {
        "embedding_provider": str(provider).strip() if provider is not None else None,
        "embedding_trusted": bool(trusted),
        "embedding_trust_status": str(trust_status).strip() or "unknown",
        "embedding_trust_reason": str(trust_reason).strip(),
    }


def _split_evidence_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip() for item in value if str(item).strip()]
    return [item.strip() for item in str(value).split(",") if item.strip()]


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_text(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


def _clip_text(value: Any, *, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if limit <= 0:
        return ""
    return text[:limit]
