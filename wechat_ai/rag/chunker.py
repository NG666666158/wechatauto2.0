from __future__ import annotations

from dataclasses import dataclass
from typing import TypedDict


class KnowledgeDocument(TypedDict):
    doc_id: str
    title: str
    source: str
    text: str


class DocumentChunk(TypedDict):
    doc_id: str
    title: str
    source: str
    chunk_index: int
    text: str


@dataclass(frozen=True)
class Chunker:
    chunk_size: int = 1000
    overlap: int = 200
    strategy: str = "recursive"
    separators: tuple[str, ...] = ("\n\n", "\n", "。", "；", "，", " ")
    sentence_endings: tuple[str, ...] = ("。", "！", "？", "；", ".", "!", "?", ";")

    def __post_init__(self) -> None:
        if self.chunk_size <= 0:
            raise ValueError("chunk_size must be positive")
        if self.overlap < 0:
            raise ValueError("overlap must be non-negative")
        if self.overlap >= self.chunk_size:
            raise ValueError("overlap must be smaller than chunk_size")
        if self.strategy not in {"recursive", "semantic_overlap"}:
            raise ValueError("strategy must be recursive or semantic_overlap")

    def chunk_document(self, document: KnowledgeDocument) -> list[DocumentChunk]:
        text = document["text"]
        if text == "":
            return []

        chunk_texts = self._split_text(text)
        chunks: list[DocumentChunk] = []
        for chunk_index, chunk_text in enumerate(chunk_texts):
            if chunk_text == "":
                continue
            chunks.append(
                {
                    "doc_id": document["doc_id"],
                    "title": document["title"],
                    "source": document["source"],
                    "chunk_index": chunk_index,
                    "text": chunk_text,
                }
            )
        return chunks

    def _split_text(self, text: str) -> list[str]:
        cleaned = text.strip()
        if not cleaned:
            return []
        if self.strategy == "semantic_overlap":
            return self._semantic_overlap_split(cleaned)
        return self._recursive_split(cleaned, self.separators)

    def _recursive_split(self, text: str, separators: tuple[str, ...]) -> list[str]:
        if len(text) <= self.chunk_size:
            return [text]
        if not separators:
            return self._character_windows(text)

        separator = separators[0]
        if separator not in text:
            return self._recursive_split(text, separators[1:])

        pieces: list[str] = []
        for part in self._split_by_separator(text, separator):
            cleaned = part.strip()
            if not cleaned:
                continue
            pieces.extend(self._recursive_split(cleaned, separators[1:]))
        return self._merge_pieces(pieces, joiner=separator)

    def _split_by_separator(self, text: str, separator: str) -> list[str]:
        raw_parts = text.split(separator)
        if separator in {"。", "；", "，"}:
            return [f"{part}{separator}" for part in raw_parts[:-1] if part.strip()] + [raw_parts[-1]]
        return raw_parts

    def _merge_pieces(self, pieces: list[str], *, joiner: str) -> list[str]:
        merged: list[str] = []
        current = ""
        for piece in pieces:
            if not current:
                current = piece
                continue
            candidate = f"{current}{joiner}{piece}"
            if len(candidate) <= self.chunk_size:
                current = candidate
                continue
            merged.append(current)
            current = piece
        if current:
            merged.append(current)
        return merged

    def _character_windows(self, text: str) -> list[str]:
        step = self.chunk_size - self.overlap
        return [text[start : start + self.chunk_size] for start in range(0, len(text), step) if text[start : start + self.chunk_size]]

    def _semantic_overlap_split(self, text: str) -> list[str]:
        units = self._semantic_units(text)
        if not units:
            return []

        base_chunks = self._merge_pieces(units, joiner="")
        if self.overlap == 0 or len(base_chunks) <= 1:
            return base_chunks

        chunks = [base_chunks[0]]
        for chunk in base_chunks[1:]:
            prefix = chunks[-1][-self.overlap :]
            chunks.append(f"{prefix}{chunk}")
        return chunks

    def _semantic_units(self, text: str) -> list[str]:
        units: list[str] = []
        for paragraph in text.split("\n\n"):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            for sentence in self._split_sentences(paragraph):
                if len(sentence) <= self.chunk_size:
                    units.append(sentence)
                else:
                    units.extend(self._recursive_split(sentence, self.separators))
        return units

    def _split_sentences(self, text: str) -> list[str]:
        sentences: list[str] = []
        start = 0
        for index, char in enumerate(text):
            if char not in self.sentence_endings:
                continue
            sentence = text[start : index + 1].strip()
            if sentence:
                sentences.append(sentence)
            start = index + 1

        tail = text[start:].strip()
        if tail:
            sentences.append(tail)
        return sentences
