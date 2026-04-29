from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence


DEFAULT_MIN_TOP_SCORE = 0.7
REVIEW_TRUST_STATUSES = {"fake", "untrusted"}


@dataclass(frozen=True)
class AcceptanceReportBuilder:
    min_top_score: float = DEFAULT_MIN_TOP_SCORE

    def build(
        self,
        questions: Sequence[str],
        results_by_query: Mapping[str, Iterable[Any]] | Sequence[Iterable[Any]],
    ) -> dict[str, Any]:
        items = [
            self._build_item(query, _results_for_query(results_by_query, query, index))
            for index, query in enumerate(questions)
        ]
        answered_items = [item for item in items if item["top_score"] is not None]
        top_scores = [float(item["top_score"]) for item in answered_items]

        return {
            "total_questions": len(questions),
            "answered_questions": len(answered_items),
            "missing_questions": len(questions) - len(answered_items),
            "average_top_score": round(sum(top_scores) / len(top_scores), 4) if top_scores else 0.0,
            "trusted_result_count": sum(1 for item in answered_items if item["trust_status"] == "trusted"),
            "needs_review": any(item["verdict"] != "hit" for item in items),
            "items": items,
        }

    def _build_item(self, query: str, results: Iterable[Any]) -> dict[str, Any]:
        top_result = _first_result(results)
        if top_result is None:
            return {
                "query": query,
                "top_chunk_id": None,
                "top_score": None,
                "source": "",
                "retrieval_sources": [],
                "match_terms": [],
                "trust_status": "",
                "verdict": "miss",
            }

        metadata = _metadata(top_result)
        top_score = _score(top_result)
        trust_status = _field(top_result, metadata, "trust_status", "embedding_trust_status", default="trusted")
        verdict = _verdict(top_score=top_score, trust_status=trust_status, min_top_score=self.min_top_score)

        return {
            "query": query,
            "top_chunk_id": _field(top_result, metadata, "chunk_id", "source_id", default=""),
            "top_score": round(top_score, 4),
            "source": _field(top_result, metadata, "source", "evidence", default=""),
            "retrieval_sources": _split_values(_field(top_result, metadata, "retrieval_sources", default=[])),
            "match_terms": _split_values(_field(top_result, metadata, "match_terms", default=[])),
            "trust_status": trust_status,
            "verdict": verdict,
        }


def build_acceptance_report(
    questions: Sequence[str],
    results_by_query: Mapping[str, Iterable[Any]] | Sequence[Iterable[Any]],
    *,
    min_top_score: float = DEFAULT_MIN_TOP_SCORE,
) -> dict[str, Any]:
    return AcceptanceReportBuilder(min_top_score=min_top_score).build(questions, results_by_query)


def render_acceptance_report_markdown(report: Mapping[str, Any]) -> str:
    lines = [
        "# Knowledge Retrieval Acceptance Report",
        "",
        "## Summary",
        f"- Total questions: {int(report.get('total_questions', 0))}",
        f"- Answered questions: {int(report.get('answered_questions', 0))}",
        f"- Missing questions: {int(report.get('missing_questions', 0))}",
        f"- Average top score: {_format_score(report.get('average_top_score'))}",
        f"- Trusted result count: {int(report.get('trusted_result_count', 0))}",
        f"- Needs review: {_yes_no(bool(report.get('needs_review', False)))}",
        "",
        "## Items",
        "| Query | Verdict | Top chunk | Top score | Source | Retrieval sources | Match terms | Trust |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]

    items = report.get("items", [])
    if isinstance(items, Iterable) and not isinstance(items, (str, bytes, dict)):
        for item in items:
            if isinstance(item, Mapping):
                lines.append(_render_item_row(item))

    return "\n".join(lines)


def _results_for_query(
    results_by_query: Mapping[str, Iterable[Any]] | Sequence[Iterable[Any]],
    query: str,
    index: int,
) -> Iterable[Any]:
    if isinstance(results_by_query, Mapping):
        return results_by_query.get(query, [])
    if index < len(results_by_query):
        return results_by_query[index]
    return []


def _first_result(results: Iterable[Any]) -> Any | None:
    for result in results:
        return result
    return None


def _metadata(result: Any) -> Mapping[str, Any]:
    if isinstance(result, Mapping):
        metadata = result.get("metadata", {})
        return metadata if isinstance(metadata, Mapping) else {}
    metadata = getattr(result, "metadata", {})
    return metadata if isinstance(metadata, Mapping) else {}


def _score(result: Any) -> float:
    raw_score = result.get("score") if isinstance(result, Mapping) else getattr(result, "score", 0.0)
    try:
        return float(raw_score)
    except (TypeError, ValueError):
        return 0.0


def _field(result: Any, metadata: Mapping[str, Any], *keys: str, default: Any) -> Any:
    for key in keys:
        value = result.get(key) if isinstance(result, Mapping) else getattr(result, key, None)
        if value not in (None, ""):
            return value
        value = metadata.get(key)
        if value not in (None, ""):
            return value
    return default


def _split_values(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        parts = value.split(",")
    elif isinstance(value, Iterable):
        parts = [str(item) for item in value]
    else:
        parts = [str(value)]
    return [part.strip() for part in parts if part.strip()]


def _verdict(*, top_score: float, trust_status: str, min_top_score: float) -> str:
    if top_score < min_top_score:
        return "needs_review"
    if trust_status.strip().lower() in REVIEW_TRUST_STATUSES:
        return "needs_review"
    return "hit"


def _format_score(score: Any) -> str:
    if score is None:
        return ""
    try:
        return f"{float(score):.4f}"
    except (TypeError, ValueError):
        return ""


def _render_item_row(item: Mapping[str, Any]) -> str:
    values = [
        str(item.get("query") or ""),
        str(item.get("verdict") or ""),
        str(item.get("top_chunk_id") or ""),
        _format_score(item.get("top_score")),
        str(item.get("source") or ""),
        ", ".join(_split_values(item.get("retrieval_sources"))),
        ", ".join(_split_values(item.get("match_terms"))),
        str(item.get("trust_status") or ""),
    ]
    return "| " + " | ".join(_escape_markdown_table(value) for value in values) + " |"


def _escape_markdown_table(value: str) -> str:
    return value.replace("|", "\\|").replace("\n", " ")


def _yes_no(value: bool) -> str:
    return "yes" if value else "no"
