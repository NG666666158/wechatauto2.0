from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Callable, TypedDict


class FAQItem(TypedDict, total=False):
    question: str
    answer: str
    confidence: str


class AINormalizedPreview(TypedDict):
    faq_items: list[FAQItem]
    allowed_claims: list[str]
    forbidden_claims: list[str]
    handoff_rules: list[str]
    source_excerpt: str
    warnings: list[str]


Generator = Callable[[str], str]


PROMPT_TEMPLATE = """你是微信客服知识库入库前的 AI 结构化预处理助手。

请只基于给定资料做 preview-only 结构化整理，不要编造资料中没有的产品能力、价格、时效、售后承诺或法律结论。
你的输出用于客服回复前的知识库预览，不会直接写入索引。

请特别注意：
1. 常见问答要适合微信客服短回复场景。
2. allowed_claims 只能放资料中可以确认的事实。
3. forbidden_claims 放客服不能越权承诺、不能替用户决定、不能保证结果的内容。
4. handoff_rules 放需要人工介入的规则，例如退款争议、投诉、法律/医疗/金融等敏感内容、隐私凭证、验证码、账号安全或资料不足。
5. source_excerpt 摘录最关键的原文依据，保持简短。
6. warnings 写入资料不足、矛盾、敏感风险或需要复核的提示。

只能返回一个合法 JSON 对象，不要 Markdown，不要解释。字段必须为：
{{
  "faq_items": [{{"question": "...", "answer": "...", "confidence": "high|medium|low"}}],
  "allowed_claims": ["..."],
  "forbidden_claims": ["..."],
  "handoff_rules": ["..."],
  "source_excerpt": "...",
  "warnings": ["..."]
}}

标题：{title}
来源：{source}
资料：
{text}
"""


@dataclass(frozen=True)
class AINormalizer:
    generator: Generator
    max_prompt_chars: int = 6000
    excerpt_chars: int = 240

    def normalize_document(self, *, text: str, title: str = "", source: str = "") -> AINormalizedPreview:
        cleaned_text = text.strip()
        if not cleaned_text:
            return self._empty_preview(
                source_excerpt="",
                warnings=["文档内容为空，已跳过 AI 结构化预处理。"],
            )

        fallback_excerpt = self._make_excerpt(cleaned_text)
        prompt = self._build_prompt(text=cleaned_text, title=title.strip(), source=source.strip())
        try:
            raw_response = self.generator(prompt)
        except Exception as exc:  # pragma: no cover - defensive boundary for provider adapters
            return self._empty_preview(
                source_excerpt=fallback_excerpt,
                warnings=[f"AI 结构化预处理调用失败：{exc}"],
            )

        try:
            payload = self._parse_json_object(raw_response)
        except ValueError as exc:
            return self._empty_preview(
                source_excerpt=fallback_excerpt,
                warnings=[f"无法解析模型返回的 JSON：{exc}"],
            )

        return self._coerce_preview(payload=payload, fallback_excerpt=fallback_excerpt)

    def _build_prompt(self, *, text: str, title: str, source: str) -> str:
        prompt_text = text
        if len(prompt_text) > self.max_prompt_chars:
            prompt_text = prompt_text[: self.max_prompt_chars] + "\n\n[资料过长，已截断用于预览]"
        return PROMPT_TEMPLATE.format(title=title or "未命名资料", source=source or "未知来源", text=prompt_text)

    def _parse_json_object(self, raw_response: str) -> dict[str, object]:
        text = raw_response.strip()
        if not text:
            raise ValueError("模型返回为空")
        if text.startswith("```"):
            text = self._strip_markdown_fence(text)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{exc.msg}（第 {exc.lineno} 行第 {exc.colno} 列）") from exc
        if not isinstance(parsed, dict):
            raise ValueError("顶层结果不是 JSON 对象")
        return parsed

    def _strip_markdown_fence(self, text: str) -> str:
        lines = text.splitlines()
        if len(lines) >= 2 and lines[0].startswith("```") and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
        return text

    def _coerce_preview(self, *, payload: dict[str, object], fallback_excerpt: str) -> AINormalizedPreview:
        return {
            "faq_items": self._coerce_faq_items(payload.get("faq_items")),
            "allowed_claims": self._coerce_string_list(payload.get("allowed_claims")),
            "forbidden_claims": self._coerce_string_list(payload.get("forbidden_claims")),
            "handoff_rules": self._coerce_string_list(payload.get("handoff_rules")),
            "source_excerpt": self._coerce_string(payload.get("source_excerpt")) or fallback_excerpt,
            "warnings": self._coerce_string_list(payload.get("warnings")),
        }

    def _coerce_faq_items(self, value: object) -> list[FAQItem]:
        if not isinstance(value, list):
            return []
        items: list[FAQItem] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            question = self._coerce_string(item.get("question"))
            answer = self._coerce_string(item.get("answer"))
            if not question or not answer:
                continue
            faq_item: FAQItem = {"question": question, "answer": answer}
            confidence = self._coerce_string(item.get("confidence"))
            if confidence:
                faq_item["confidence"] = confidence
            items.append(faq_item)
        return items

    def _coerce_string_list(self, value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        strings: list[str] = []
        for item in value:
            string_item = self._coerce_string(item)
            if string_item:
                strings.append(string_item)
        return strings

    def _coerce_string(self, value: object) -> str:
        if isinstance(value, str):
            return value.strip()
        return ""

    def _make_excerpt(self, text: str) -> str:
        collapsed = " ".join(text.split())
        if len(collapsed) <= self.excerpt_chars:
            return collapsed
        return collapsed[: self.excerpt_chars].rstrip() + "..."

    def _empty_preview(self, *, source_excerpt: str, warnings: list[str]) -> AINormalizedPreview:
        return {
            "faq_items": [],
            "allowed_claims": [],
            "forbidden_claims": [],
            "handoff_rules": [],
            "source_excerpt": source_excerpt,
            "warnings": warnings,
        }
