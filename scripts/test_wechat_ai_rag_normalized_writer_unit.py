from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


from wechat_ai.rag.normalized_writer import (  # type: ignore  # noqa: E402
    NormalizedKnowledgeWriter,
)


class NormalizedKnowledgeWriterTests(unittest.TestCase):
    def test_build_document_renders_complete_preview(self) -> None:
        preview = {
            "faq_items": [
                {
                    "question": "如何申请退款？",
                    "answer": "请提供订单号，由人工核实退款条件。",
                    "confidence": "high",
                }
            ],
            "allowed_claims": ["支持查询订单状态。"],
            "forbidden_claims": ["不能承诺当天必退。"],
            "handoff_rules": ["涉及退款金额争议时转人工。"],
            "source_excerpt": "退款需要订单号，金额争议转人工。",
            "warnings": ["不要索要验证码。"],
        }

        result = NormalizedKnowledgeWriter().build_document(
            preview=preview,
            title="售后规则",
            source="knowledge/after-sale.md",
        )

        self.assertEqual(result.filename, "shou-hou-gui-ze.md")
        self.assertEqual(result.metadata["title"], "售后规则")
        self.assertEqual(result.metadata["source"], "knowledge/after-sale.md")
        self.assertEqual(result.metadata["suggested_filename"], "shou-hou-gui-ze.md")
        self.assertEqual(result.metadata["normalized"], True)
        self.assertIn("# 售后规则", result.markdown)
        self.assertIn("**来源**：knowledge/after-sale.md", result.markdown)
        self.assertIn("## 常见问答", result.markdown)
        self.assertIn("### 1. 如何申请退款？", result.markdown)
        self.assertIn("请提供订单号，由人工核实退款条件。", result.markdown)
        self.assertIn("置信度：high", result.markdown)
        self.assertIn("- 支持查询订单状态。", result.markdown)
        self.assertIn("- 不能承诺当天必退。", result.markdown)
        self.assertIn("- 涉及退款金额争议时转人工。", result.markdown)
        self.assertIn("> 退款需要订单号，金额争议转人工。", result.markdown)
        self.assertIn("- 不要索要验证码。", result.markdown)

    def test_build_document_uses_empty_state_text_for_empty_lists(self) -> None:
        preview = {
            "faq_items": [],
            "allowed_claims": [],
            "forbidden_claims": [],
            "handoff_rules": [],
            "source_excerpt": "",
            "warnings": [],
        }

        result = NormalizedKnowledgeWriter().build_document(
            preview=preview,
            title="",
            source="",
        )

        self.assertEqual(result.filename, "ai-normalized-knowledge.md")
        self.assertEqual(result.metadata["title"], "AI Normalized Knowledge")
        self.assertEqual(result.metadata["source"], "")
        self.assertIn("# AI Normalized Knowledge", result.markdown)
        self.assertIn("- 暂无常见问答。", result.markdown)
        self.assertIn("- 暂无可确认事实。", result.markdown)
        self.assertIn("- 暂无禁止承诺事项。", result.markdown)
        self.assertIn("- 暂无人工介入规则。", result.markdown)
        self.assertIn("> 暂无来源摘录。", result.markdown)
        self.assertIn("- 暂无复核提示。", result.markdown)

    def test_build_document_sanitizes_chinese_title_and_special_characters(self) -> None:
        preview = {
            "faq_items": [],
            "allowed_claims": [],
            "forbidden_claims": [],
            "handoff_rules": [],
            "source_excerpt": "",
            "warnings": [],
        }

        result = NormalizedKnowledgeWriter().build_document(
            preview=preview,
            title="退款/售后：规则 V2!!!",
            source="uploads\\2026\\售后 FAQ?.docx",
        )

        self.assertEqual(result.filename, "tui-kuan-shou-hou-gui-ze-v2.md")
        self.assertNotIn("/", result.filename)
        self.assertNotIn("\\", result.filename)
        self.assertNotIn("?", result.filename)
        self.assertLessEqual(len(result.filename), 120)


if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(NormalizedKnowledgeWriterTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
