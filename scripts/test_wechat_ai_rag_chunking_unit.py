from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


from wechat_ai.rag.chunker import Chunker  # type: ignore  # noqa: E402
from wechat_ai.rag.embeddings import BaseEmbeddings, FakeEmbeddings  # type: ignore  # noqa: E402


class ChunkerTests(unittest.TestCase):
    def test_short_document_passes_through_as_single_chunk(self) -> None:
        chunker = Chunker(chunk_size=50, overlap=10)

        chunks = chunker.chunk_document(
            {
                "doc_id": "doc-1",
                "title": "FAQ",
                "source": "knowledge/faq.md",
                "text": "short document",
            }
        )

        self.assertEqual(
            chunks,
            [
                {
                    "doc_id": "doc-1",
                    "title": "FAQ",
                    "source": "knowledge/faq.md",
                    "chunk_index": 0,
                    "text": "short document",
                }
            ],
        )

    def test_multi_chunk_output_preserves_overlap_and_metadata(self) -> None:
        chunker = Chunker(chunk_size=6, overlap=2)

        chunks = chunker.chunk_document(
            {
                "doc_id": "doc-2",
                "title": "Guide",
                "source": "knowledge/guide.txt",
                "text": "abcdefghijkl",
            }
        )

        self.assertEqual(
            chunks,
            [
                {
                    "doc_id": "doc-2",
                    "title": "Guide",
                    "source": "knowledge/guide.txt",
                    "chunk_index": 0,
                    "text": "abcdef",
                },
                {
                    "doc_id": "doc-2",
                    "title": "Guide",
                    "source": "knowledge/guide.txt",
                    "chunk_index": 1,
                    "text": "efghij",
                },
                {
                    "doc_id": "doc-2",
                    "title": "Guide",
                    "source": "knowledge/guide.txt",
                    "chunk_index": 2,
                    "text": "ijkl",
                },
            ],
        )

    def test_invalid_overlap_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            Chunker(chunk_size=5, overlap=5)

    def test_recursive_chunking_prefers_paragraph_boundaries_before_character_windows(self) -> None:
        chunker = Chunker(chunk_size=24, overlap=4)

        chunks = chunker.chunk_document(
            {
                "doc_id": "doc-3",
                "title": "客服规则",
                "source": "knowledge/service.md",
                "text": "售前说明：支持先咨询再下单。\n\n售后说明：退款需要订单号。\n\n隐私说明：不要索要验证码。",
            }
        )

        chunk_texts = [chunk["text"] for chunk in chunks]
        self.assertTrue(any(text == "售前说明：支持先咨询再下单。" for text in chunk_texts))
        self.assertTrue(any(text == "售后说明：退款需要订单号。" for text in chunk_texts))
        self.assertTrue(any(text == "隐私说明：不要索要验证码。" for text in chunk_texts))

    def test_recursive_chunking_keeps_chinese_sentence_punctuation(self) -> None:
        chunker = Chunker(chunk_size=12, overlap=2)

        chunks = chunker.chunk_document(
            {
                "doc_id": "doc-4",
                "title": "售后",
                "source": "knowledge/after-sale.md",
                "text": "第一条规则。第二条规则。第三条规则。",
            }
        )

        chunk_text = "\n".join(chunk["text"] for chunk in chunks)
        self.assertIn("第一条规则。", chunk_text)
        self.assertIn("第二条规则。", chunk_text)
        self.assertIn("第三条规则。", chunk_text)


    def test_semantic_overlap_chunks_by_sentence_and_adds_fixed_overlap(self) -> None:
        chunker = Chunker(chunk_size=16, overlap=5, strategy="semantic_overlap")

        chunks = chunker.chunk_document(
            {
                "doc_id": "doc-5",
                "title": "客服规则",
                "source": "knowledge/service.md",
                "text": "第一条规则。第二条规则。第三条规则。第四条规则。",
            }
        )

        self.assertEqual([chunk["text"] for chunk in chunks], ["第一条规则。第二条规则。", "二条规则。第三条规则。第四条规则。"])

    def test_unknown_chunk_strategy_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            Chunker(strategy="unknown")


class EmbeddingsTests(unittest.TestCase):
    def test_base_embeddings_requires_implementation(self) -> None:
        provider = BaseEmbeddings()

        with self.assertRaises(NotImplementedError):
            provider.embed_documents(["hello"])
        with self.assertRaises(NotImplementedError):
            provider.embed_query("hello")

    def test_fake_embeddings_are_deterministic_for_documents_and_queries(self) -> None:
        provider = FakeEmbeddings(dimensions=6)

        document_vectors = provider.embed_documents(["alpha", "beta", "alpha"])
        query_vector = provider.embed_query("alpha")

        self.assertEqual(len(document_vectors), 3)
        self.assertEqual(len(document_vectors[0]), 6)
        self.assertEqual(document_vectors[0], document_vectors[2])
        self.assertEqual(document_vectors[0], query_vector)
        self.assertNotEqual(document_vectors[0], document_vectors[1])


if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(ChunkerTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(EmbeddingsTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
