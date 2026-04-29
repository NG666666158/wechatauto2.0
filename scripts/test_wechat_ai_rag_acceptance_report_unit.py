from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


from wechat_ai import RetrievedChunk  # type: ignore  # noqa: E402
from wechat_ai.rag.acceptance_report import (  # type: ignore  # noqa: E402
    build_acceptance_report,
    render_acceptance_report_markdown,
)


def chunk(
    *,
    chunk_id: str,
    score: float,
    source: str = "knowledge/faq.md",
    retrieval_sources: str = "dense,keyword",
    match_terms: str = "refund,billing",
    trust_status: str = "trusted",
) -> RetrievedChunk:
    return RetrievedChunk(
        text="answer text",
        score=score,
        metadata={
            "chunk_id": chunk_id,
            "source": source,
            "retrieval_sources": retrieval_sources,
            "match_terms": match_terms,
            "trust_status": trust_status,
        },
    )


class AcceptanceReportTests(unittest.TestCase):
    def test_build_report_marks_all_trusted_high_score_results_as_hits(self) -> None:
        report = build_acceptance_report(
            ["How do I refund?", "How do I install?"],
            {
                "How do I refund?": [chunk(chunk_id="refund:0", score=0.92)],
                "How do I install?": [chunk(chunk_id="install:0", score=0.84, source="knowledge/install.md")],
            },
            min_top_score=0.7,
        )

        self.assertEqual(report["total_questions"], 2)
        self.assertEqual(report["answered_questions"], 2)
        self.assertEqual(report["missing_questions"], 0)
        self.assertEqual(report["trusted_result_count"], 2)
        self.assertFalse(report["needs_review"])
        self.assertEqual(report["average_top_score"], 0.88)
        self.assertEqual([item["verdict"] for item in report["items"]], ["hit", "hit"])
        self.assertEqual(report["items"][0]["top_chunk_id"], "refund:0")
        self.assertEqual(report["items"][0]["source"], "knowledge/faq.md")
        self.assertEqual(report["items"][0]["retrieval_sources"], ["dense", "keyword"])
        self.assertEqual(report["items"][0]["match_terms"], ["refund", "billing"])

    def test_build_report_marks_empty_results_as_miss(self) -> None:
        report = build_acceptance_report(["Unknown question"], {"Unknown question": []})

        self.assertEqual(report["answered_questions"], 0)
        self.assertEqual(report["missing_questions"], 1)
        self.assertEqual(report["average_top_score"], 0.0)
        self.assertTrue(report["needs_review"])
        self.assertEqual(report["items"][0]["verdict"], "miss")
        self.assertIsNone(report["items"][0]["top_chunk_id"])
        self.assertIsNone(report["items"][0]["top_score"])

    def test_build_report_marks_low_score_top_result_as_needs_review(self) -> None:
        report = build_acceptance_report(
            ["Weak match"],
            {"Weak match": [chunk(chunk_id="weak:0", score=0.49)]},
            min_top_score=0.5,
        )

        self.assertEqual(report["answered_questions"], 1)
        self.assertEqual(report["missing_questions"], 0)
        self.assertTrue(report["needs_review"])
        self.assertEqual(report["items"][0]["verdict"], "needs_review")
        self.assertEqual(report["items"][0]["trust_status"], "trusted")

    def test_build_report_marks_fake_and_untrusted_results_as_needs_review(self) -> None:
        report = build_acceptance_report(
            ["Fake embedding", "Legacy embedding"],
            {
                "Fake embedding": [chunk(chunk_id="fake:0", score=0.95, trust_status="fake")],
                "Legacy embedding": [chunk(chunk_id="legacy:0", score=0.91, trust_status="untrusted")],
            },
            min_top_score=0.7,
        )

        self.assertEqual(report["answered_questions"], 2)
        self.assertEqual(report["trusted_result_count"], 0)
        self.assertTrue(report["needs_review"])
        self.assertEqual([item["verdict"] for item in report["items"]], ["needs_review", "needs_review"])

    def test_build_report_average_top_score_ignores_missing_questions(self) -> None:
        report = build_acceptance_report(
            ["High", "Low", "Missing"],
            {
                "High": [chunk(chunk_id="high:0", score=0.9)],
                "Low": [chunk(chunk_id="low:0", score=0.3)],
                "Missing": [],
            },
        )

        self.assertEqual(report["average_top_score"], 0.6)

    def test_render_acceptance_report_markdown_includes_summary_and_items(self) -> None:
        report = build_acceptance_report(
            ["How do I refund?", "Unknown question"],
            {
                "How do I refund?": [chunk(chunk_id="refund:0", score=0.92)],
                "Unknown question": [],
            },
            min_top_score=0.7,
        )

        markdown = render_acceptance_report_markdown(report)

        self.assertIn("# Knowledge Retrieval Acceptance Report", markdown)
        self.assertIn("- Total questions: 2", markdown)
        self.assertIn("| How do I refund? | hit | refund:0 | 0.9200 | knowledge/faq.md |", markdown)
        self.assertIn("| Unknown question | miss |  |  |  |", markdown)


if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(AcceptanceReportTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
