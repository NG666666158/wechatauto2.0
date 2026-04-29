from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import PurePath
from typing import Mapping, TypedDict

from wechat_ai.rag.ai_normalizer import AINormalizedPreview, FAQItem


DEFAULT_TITLE = "AI Normalized Knowledge"
DEFAULT_FILENAME = "ai-normalized-knowledge.md"


class NormalizedKnowledgeMetadata(TypedDict):
    title: str
    source: str
    suggested_filename: str
    normalized: bool
    format: str


@dataclass(frozen=True)
class NormalizedKnowledgeDocument:
    markdown: str
    metadata: NormalizedKnowledgeMetadata
    filename: str


class NormalizedKnowledgeWriter:
    """Render AI normalized preview data into a reviewable knowledge document."""

    max_filename_length: int = 120

    def build_document(
        self,
        *,
        preview: AINormalizedPreview,
        title: str = "",
        source: str = "",
    ) -> NormalizedKnowledgeDocument:
        clean_title = self._clean_string(title) or DEFAULT_TITLE
        clean_source = self._clean_string(source)
        filename = self.suggest_filename(title=clean_title, source=clean_source)
        metadata: NormalizedKnowledgeMetadata = {
            "title": clean_title,
            "source": clean_source,
            "suggested_filename": filename,
            "normalized": True,
            "format": "markdown",
        }
        markdown = self._render_markdown(preview=preview, title=clean_title, source=clean_source)
        return NormalizedKnowledgeDocument(markdown=markdown, metadata=metadata, filename=filename)

    def suggest_filename(self, *, title: str = "", source: str = "") -> str:
        title_input = self._clean_string(title)
        source_input = self._source_stem(source)
        slug = ""
        for candidate in (title_input, source_input):
            if candidate and candidate != DEFAULT_TITLE:
                slug = self._slugify(candidate)
            if slug:
                break
        if not slug:
            return DEFAULT_FILENAME

        filename = f"{slug}.md"
        if len(filename) <= self.max_filename_length:
            return filename

        stem_limit = self.max_filename_length - len(".md")
        return f"{slug[:stem_limit].rstrip('-')}.md" or DEFAULT_FILENAME

    def _render_markdown(self, *, preview: AINormalizedPreview, title: str, source: str) -> str:
        lines = [
            f"# {title}",
            "",
            f"**来源**：{source}" if source else "**来源**：",
            "",
            "## 常见问答",
            *self._render_faq_items(preview.get("faq_items", [])),
            "",
            "## 可确认事实",
            *self._render_list(preview.get("allowed_claims", []), empty_text="暂无可确认事实。"),
            "",
            "## 禁止承诺事项",
            *self._render_list(preview.get("forbidden_claims", []), empty_text="暂无禁止承诺事项。"),
            "",
            "## 人工介入规则",
            *self._render_list(preview.get("handoff_rules", []), empty_text="暂无人工介入规则。"),
            "",
            "## 来源摘录",
            *self._render_excerpt(preview.get("source_excerpt", "")),
            "",
            "## 复核提示",
            *self._render_list(preview.get("warnings", []), empty_text="暂无复核提示。"),
            "",
        ]
        return "\n".join(lines)

    def _render_faq_items(self, value: object) -> list[str]:
        if not isinstance(value, list):
            return ["- 暂无常见问答。"]

        lines: list[str] = []
        for index, item in enumerate(value, start=1):
            if not isinstance(item, Mapping):
                continue
            faq_item = self._coerce_faq_item(item)
            if not faq_item:
                continue
            lines.extend(
                [
                    f"### {index}. {faq_item['question']}",
                    "",
                    faq_item["answer"],
                ]
            )
            confidence = faq_item.get("confidence")
            if confidence:
                lines.extend(["", f"置信度：{confidence}"])
            lines.append("")

        if not lines:
            return ["- 暂无常见问答。"]
        while lines and lines[-1] == "":
            lines.pop()
        return lines

    def _render_list(self, value: object, *, empty_text: str) -> list[str]:
        if not isinstance(value, list):
            return [f"- {empty_text}"]
        items = [self._clean_string(item) for item in value]
        items = [item for item in items if item]
        if not items:
            return [f"- {empty_text}"]
        return [f"- {item}" for item in items]

    def _render_excerpt(self, value: object) -> list[str]:
        excerpt = self._clean_string(value)
        if not excerpt:
            return ["> 暂无来源摘录。"]
        return [f"> {line}" if line else ">" for line in excerpt.splitlines()]

    def _coerce_faq_item(self, item: Mapping[object, object]) -> FAQItem | None:
        question = self._clean_string(item.get("question"))
        answer = self._clean_string(item.get("answer"))
        if not question or not answer:
            return None
        faq_item: FAQItem = {"question": question, "answer": answer}
        confidence = self._clean_string(item.get("confidence"))
        if confidence:
            faq_item["confidence"] = confidence
        return faq_item

    def _source_stem(self, source: str) -> str:
        clean_source = self._clean_string(source).replace("\\", "/")
        if not clean_source:
            return ""
        return PurePath(clean_source).stem

    def _slugify(self, value: str) -> str:
        normalized = unicodedata.normalize("NFKD", value)
        parts: list[str] = []
        for char in normalized:
            if char.isascii() and char.isalnum():
                parts.append(char.lower())
                continue
            mapped = _CJK_SLUG_MAP.get(char)
            if mapped:
                parts.extend(["-", mapped, "-"])
                continue
            if char in {" ", "-", "_", ".", "/", "\\", ":", "："}:
                parts.append("-")
        slug = re.sub(r"-+", "-", "".join(parts)).strip("-")
        return slug

    def _clean_string(self, value: object) -> str:
        if isinstance(value, str):
            return value.strip()
        return ""


_CJK_SLUG_MAP = {
    "后": "hou",
    "规": "gui",
    "款": "kuan",
    "则": "ze",
    "售": "shou",
    "退": "tui",
}
