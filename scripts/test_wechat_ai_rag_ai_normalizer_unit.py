from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


from wechat_ai.rag.ai_normalizer import AINormalizer  # type: ignore  # noqa: E402


class AINormalizerTests(unittest.TestCase):
    def test_normalize_document_parses_valid_json_preview(self) -> None:
        prompts: list[str] = []

        def generator(prompt: str) -> str:
            prompts.append(prompt)
            return json.dumps(
                {
                    "faq_items": [
                        {
                            "question": "怎么申请退款？",
                            "answer": "提供订单号后由人工核实退款条件。",
                            "confidence": "high",
                        }
                    ],
                    "allowed_claims": ["支持提供订单状态查询"],
                    "forbidden_claims": ["不能承诺当天必退"],
                    "handoff_rules": ["涉及退款金额争议时转人工"],
                    "source_excerpt": "退款需提供订单号，金额争议转人工。",
                    "warnings": ["不要索要验证码"],
                },
                ensure_ascii=False,
            )

        result = AINormalizer(generator=generator).normalize_document(
            text="退款需提供订单号。涉及金额争议时请转人工。不要索要验证码。",
            title="售后规则",
            source="knowledge/after-sale.md",
        )

        self.assertEqual(result["faq_items"][0]["question"], "怎么申请退款？")
        self.assertEqual(result["allowed_claims"], ["支持提供订单状态查询"])
        self.assertEqual(result["forbidden_claims"], ["不能承诺当天必退"])
        self.assertEqual(result["handoff_rules"], ["涉及退款金额争议时转人工"])
        self.assertEqual(result["source_excerpt"], "退款需提供订单号，金额争议转人工。")
        self.assertEqual(result["warnings"], ["不要索要验证码"])
        self.assertEqual(len(prompts), 1)
        self.assertIn("微信客服", prompts[0])
        self.assertIn("不能越权承诺", prompts[0])
        self.assertIn("售后规则", prompts[0])

    def test_normalize_document_returns_degraded_preview_for_invalid_json(self) -> None:
        result = AINormalizer(generator=lambda prompt: "不是 JSON").normalize_document(
            text="客户投诉或法律风险请转人工。",
            title="升级规则",
            source="knowledge/rules.txt",
        )

        self.assertEqual(result["faq_items"], [])
        self.assertEqual(result["allowed_claims"], [])
        self.assertEqual(result["forbidden_claims"], [])
        self.assertEqual(result["handoff_rules"], [])
        self.assertIn("无法解析模型返回的 JSON", result["warnings"][0])
        self.assertEqual(result["source_excerpt"], "客户投诉或法律风险请转人工。")

    def test_normalize_document_rejects_empty_content_without_calling_generator(self) -> None:
        calls = 0

        def generator(prompt: str) -> str:
            nonlocal calls
            calls += 1
            return "{}"

        result = AINormalizer(generator=generator).normalize_document(
            text="   ",
            title="空文档",
            source="knowledge/empty.md",
        )

        self.assertEqual(calls, 0)
        self.assertEqual(result["faq_items"], [])
        self.assertEqual(result["allowed_claims"], [])
        self.assertEqual(result["forbidden_claims"], [])
        self.assertEqual(result["handoff_rules"], [])
        self.assertEqual(result["source_excerpt"], "")
        self.assertEqual(result["warnings"], ["文档内容为空，已跳过 AI 结构化预处理。"])


if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(AINormalizerTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
