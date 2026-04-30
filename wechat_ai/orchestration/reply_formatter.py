from __future__ import annotations

import re


_CODE_FENCE_RE = re.compile(r"```(?:[^\n`]*)\n?(.*?)```", re.DOTALL)
_INLINE_CODE_RE = re.compile(r"`([^`]+)`")
_LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_HEADING_RE = re.compile(r"^\s{0,3}#{1,6}\s*", re.MULTILINE)
_ORDERED_LIST_RE = re.compile(r"(?m)^\s*(\d+)\.\s+")
_UNORDERED_LIST_RE = re.compile(r"(?m)^\s*[-*+]\s+")
_BLOCKQUOTE_RE = re.compile(r"(?m)^\s*>\s?")
_MD_TABLE_BORDER_RE = re.compile(r"(?m)^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")


def format_reply_for_wechat(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""

    text = _CODE_FENCE_RE.sub(lambda match: match.group(1).strip(), text)
    text = _INLINE_CODE_RE.sub(lambda match: match.group(1), text)
    text = _LINK_RE.sub(lambda match: match.group(1), text)
    text = _HEADING_RE.sub("", text)
    text = _BLOCKQUOTE_RE.sub("", text)
    text = _MD_TABLE_BORDER_RE.sub("", text)
    text = _ORDERED_LIST_RE.sub(lambda match: f"{match.group(1)}. ", text)
    text = _UNORDERED_LIST_RE.sub("", text)

    replacements = {
        r"\*\*([^*\n]+)\*\*": r"\1",
        r"__([^_\n]+)__": r"\1",
        r"\*([^*\n]+)\*": r"\1",
        r"_([^_\n]+)_": r"\1",
        r"~~([^~\n]+)~~": r"\1",
    }
    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text)

    text = text.replace("\\*", "*").replace("\\_", "_").replace("\\#", "#")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
