from __future__ import annotations

from typing import Any, Mapping


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
