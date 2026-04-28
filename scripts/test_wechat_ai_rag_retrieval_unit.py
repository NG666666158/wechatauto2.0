from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP_ROOT = ROOT / ".tmp"
TMP_ROOT.mkdir(exist_ok=True)


from wechat_ai import RetrievedChunk  # type: ignore  # noqa: E402
from wechat_ai.rag.embeddings import BaseEmbeddings, EmbeddingProviderInfo, FakeEmbeddings  # type: ignore  # noqa: E402
from wechat_ai.rag.reranker import NoOpReranker  # type: ignore  # noqa: E402
from wechat_ai.rag.ingest import build_knowledge_index  # type: ignore  # noqa: E402
from wechat_ai.rag.embeddings import TrustedLocalEmbeddings  # type: ignore  # noqa: E402
from wechat_ai.rag.retriever import (  # type: ignore  # noqa: E402
    LocalIndexRetriever,
    index_embedding_provider,
    index_has_trusted_embeddings,
    index_uses_fake_embeddings,
)
from wechat_ai.rag.keyword_retriever import KeywordRetriever  # type: ignore  # noqa: E402
from wechat_ai.rag.hybrid_retriever import HybridRetriever  # type: ignore  # noqa: E402


class SemanticTestEmbeddings(BaseEmbeddings):
    def __init__(self) -> None:
        self._vectors = {
            "billing support price refund": [1.0, 0.0, 0.0],
            "installation setup guide windows": [0.0, 1.0, 0.0],
            "account reset password login": [0.0, 0.0, 1.0],
            "how do i get a refund for billing": [0.9, 0.1, 0.0],
        }

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vectors[text] for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vectors[text]


class LocalIndexRetrieverTests(unittest.TestCase):
    def _make_temp_dir(self) -> Path:
        root = TMP_ROOT / "wechat_ai_rag_retrieval"
        root.mkdir(exist_ok=True)
        return root

    def test_retrieve_returns_retrieved_chunks_in_cosine_similarity_order(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "knowledge_index.json"
        payload = {
            "chunks": [
                {
                    "text": "billing support price refund",
                    "vector": [1.0, 0.0, 0.0],
                    "metadata": {
                        "doc_id": "faq",
                        "title": "Billing FAQ",
                        "source": "wechat_ai/data/knowledge/faq.md",
                        "chunk_index": "0",
                    },
                },
                {
                    "text": "installation setup guide windows",
                    "vector": [0.0, 1.0, 0.0],
                    "metadata": {
                        "doc_id": "install",
                        "title": "Install Guide",
                        "source": "wechat_ai/data/knowledge/install.md",
                        "chunk_index": "0",
                    },
                },
                {
                    "text": "account reset password login",
                    "vector": [0.0, 0.0, 1.0],
                    "metadata": {
                        "doc_id": "account",
                        "title": "Account Help",
                        "source": "wechat_ai/data/knowledge/account.md",
                        "chunk_index": "0",
                    },
                },
            ]
        }
        index_path.write_text(json.dumps(payload), encoding="utf-8")

        retriever = LocalIndexRetriever(
            index_path=index_path,
            embeddings=SemanticTestEmbeddings(),
        )

        chunks = retriever.retrieve("how do i get a refund for billing", limit=2)

        self.assertEqual(len(chunks), 2)
        self.assertTrue(all(isinstance(chunk, RetrievedChunk) for chunk in chunks))
        self.assertEqual(chunks[0].text, "billing support price refund")
        self.assertEqual(chunks[0].metadata["doc_id"], "faq")
        self.assertGreater(chunks[0].score, chunks[1].score)
        self.assertEqual(chunks[1].text, "installation setup guide windows")

    def test_retrieve_uses_no_op_reranker_interface_without_changing_order(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "knowledge_index.json"
        index_path.write_text(
            json.dumps(
                {
                    "chunks": [
                        {
                            "text": "billing support price refund",
                            "vector": [1.0, 0.0, 0.0],
                            "metadata": {"doc_id": "faq"},
                        }
                    ]
                }
            ),
            encoding="utf-8",
        )

        retriever = LocalIndexRetriever(
            index_path=index_path,
            embeddings=SemanticTestEmbeddings(),
            reranker=NoOpReranker(),
        )

        chunks = retriever.retrieve("how do i get a refund for billing", limit=1)

        self.assertEqual([chunk.text for chunk in chunks], ["billing support price refund"])

    def test_embedding_provider_helpers_treat_fake_indexes_as_untrusted(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "fake_embeddings_index.json"
        index_path.write_text(
            json.dumps(
                {
                    "embedding_provider": "FakeEmbeddings",
                    "embedding_trusted": False,
                    "chunks": [],
                }
            ),
            encoding="utf-8",
        )

        self.assertEqual(index_embedding_provider(index_path), "FakeEmbeddings")
        self.assertTrue(index_uses_fake_embeddings(index_path))
        self.assertFalse(index_has_trusted_embeddings(index_path))

    def test_embedding_provider_helpers_trust_explicit_non_fake_provider(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "trusted_embeddings_index.json"
        index_path.write_text(
            json.dumps(
                {
                    "embedding_provider": "TrustedFoo",
                    "embedding_trusted": True,
                    "chunks": [],
                }
            ),
            encoding="utf-8",
        )

        self.assertEqual(index_embedding_provider(index_path), "TrustedFoo")
        self.assertFalse(index_uses_fake_embeddings(index_path))
        self.assertTrue(index_has_trusted_embeddings(index_path))

    def test_embedding_provider_helpers_keep_legacy_fake_index_untrusted(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "legacy_fake_embeddings_index.json"
        index_path.write_text(json.dumps({"embedding_provider": "FakeEmbeddings", "chunks": []}), encoding="utf-8")

        self.assertEqual(index_embedding_provider(index_path), "FakeEmbeddings")
        self.assertTrue(index_uses_fake_embeddings(index_path))
        self.assertFalse(index_has_trusted_embeddings(index_path))

    def test_embedding_provider_helpers_keep_legacy_non_fake_index_untrusted(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "legacy_provider_index.json"
        index_path.write_text(json.dumps({"embedding_provider": "TrustedFoo", "chunks": []}), encoding="utf-8")

        self.assertEqual(index_embedding_provider(index_path), "TrustedFoo")
        self.assertFalse(index_uses_fake_embeddings(index_path))
        self.assertFalse(index_has_trusted_embeddings(index_path))

    def test_embedding_provider_info_exposes_trust_status_and_reason(self) -> None:
        fake_info = EmbeddingProviderInfo.from_index_payload(
            {"embedding_provider": "FakeEmbeddings", "embedding_trusted": False}
        )
        trusted_info = EmbeddingProviderInfo.from_index_payload(
            {"embedding_provider": "TrustedFoo", "embedding_trusted": True}
        )
        legacy_info = EmbeddingProviderInfo.from_index_payload(
            {"embedding_provider": "TrustedFoo"}
        )

        self.assertEqual(fake_info.trust_status, "fake")
        self.assertEqual(fake_info.trust_reason, "fake_embedding_provider")
        self.assertEqual(trusted_info.trust_status, "trusted")
        self.assertEqual(trusted_info.trust_reason, "")
        self.assertEqual(legacy_info.trust_status, "untrusted")
        self.assertEqual(legacy_info.trust_reason, "embedding_trust_not_declared")

    def test_build_knowledge_index_defaults_to_fake_untrusted_embeddings(self) -> None:
        temp_dir = self._make_temp_dir()
        knowledge_dir = temp_dir / "default_fake"
        knowledge_dir.mkdir(exist_ok=True)
        (knowledge_dir / "faq.md").write_text("# FAQ\nrefund policy", encoding="utf-8")
        index_path = temp_dir / "default_fake_index.json"

        summary = build_knowledge_index(
            knowledge_dir=knowledge_dir,
            index_path=index_path,
            chunk_size=100,
            overlap=0,
        )

        payload = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertEqual(summary["embedding_provider"], "FakeEmbeddings")
        self.assertFalse(summary["embedding_trusted"])
        self.assertEqual(payload["embedding_provider"], "FakeEmbeddings")
        self.assertFalse(payload["embedding_trusted"])

    def test_build_knowledge_index_keeps_fake_embeddings_untrusted(self) -> None:
        temp_dir = self._make_temp_dir()
        knowledge_dir = temp_dir / "explicit_fake"
        knowledge_dir.mkdir(exist_ok=True)
        (knowledge_dir / "faq.md").write_text("# FAQ\nrefund policy", encoding="utf-8")
        index_path = temp_dir / "explicit_fake_index.json"

        summary = build_knowledge_index(
            knowledge_dir=knowledge_dir,
            index_path=index_path,
            chunk_size=100,
            overlap=0,
            embeddings=FakeEmbeddings(embedding_trusted=True),
        )

        payload = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertEqual(summary["embedding_provider"], "FakeEmbeddings")
        self.assertFalse(summary["embedding_trusted"])
        self.assertEqual(payload["embedding_provider"], "FakeEmbeddings")
        self.assertFalse(payload["embedding_trusted"])

    def test_build_knowledge_index_uses_trusted_embedding_provider_metadata(self) -> None:
        temp_dir = self._make_temp_dir()
        knowledge_dir = temp_dir / "trusted_local"
        knowledge_dir.mkdir(exist_ok=True)
        (knowledge_dir / "faq.md").write_text("# FAQ\nrefund policy", encoding="utf-8")
        index_path = temp_dir / "trusted_local_index.json"

        summary = build_knowledge_index(
            knowledge_dir=knowledge_dir,
            index_path=index_path,
            chunk_size=100,
            overlap=0,
            embeddings=TrustedLocalEmbeddings(),
        )

        payload = json.loads(index_path.read_text(encoding="utf-8"))
        self.assertEqual(summary["embedding_provider"], "TrustedLocalEmbeddings")
        self.assertTrue(summary["embedding_trusted"])
        self.assertEqual(payload["embedding_provider"], "TrustedLocalEmbeddings")
        self.assertTrue(payload["embedding_trusted"])


class KeywordRetrieverTests(unittest.TestCase):
    def _make_temp_dir(self) -> Path:
        root = TMP_ROOT / "wechat_ai_rag_keyword_retrieval"
        root.mkdir(exist_ok=True)
        return root

    def test_retrieve_ranks_by_keyword_overlap_and_records_match_terms(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "knowledge_index.json"
        index_path.write_text(
            json.dumps(
                {
                    "chunks": [
                        {
                            "text": "refund billing support policy",
                            "metadata": {"doc_id": "refund", "chunk_index": "0"},
                        },
                        {
                            "text": "windows installation setup guide",
                            "metadata": {"doc_id": "install", "chunk_index": "0"},
                        },
                    ]
                }
            ),
            encoding="utf-8",
        )

        chunks = KeywordRetriever(index_path).retrieve("billing refund help", limit=2)

        self.assertEqual([chunk.text for chunk in chunks], ["refund billing support policy"])
        self.assertEqual(chunks[0].metadata["retriever"], "keyword")
        self.assertEqual(chunks[0].metadata["match_terms"], "billing,refund")


class HybridRetrieverTests(unittest.TestCase):
    def _make_temp_dir(self) -> Path:
        root = TMP_ROOT / "wechat_ai_rag_hybrid_retrieval"
        root.mkdir(exist_ok=True)
        return root

    def test_retrieve_merges_dense_and_keyword_results_with_source_scores(self) -> None:
        temp_dir = self._make_temp_dir()
        index_path = temp_dir / "knowledge_index.json"
        index_path.write_text(
            json.dumps(
                {
                    "chunks": [
                        {
                            "text": "billing support price refund",
                            "vector": [1.0, 0.0, 0.0],
                            "metadata": {"doc_id": "faq", "chunk_index": "0"},
                        },
                        {
                            "text": "installation setup guide windows",
                            "vector": [0.0, 1.0, 0.0],
                            "metadata": {"doc_id": "install", "chunk_index": "0"},
                        },
                    ]
                }
            ),
            encoding="utf-8",
        )
        dense = LocalIndexRetriever(index_path=index_path, embeddings=SemanticTestEmbeddings())
        keyword = KeywordRetriever(index_path=index_path)
        retriever = HybridRetriever(dense_retriever=dense, keyword_retriever=keyword)

        chunks = retriever.retrieve("how do i get a refund for billing", limit=2)

        self.assertEqual(chunks[0].text, "billing support price refund")
        self.assertEqual(chunks[0].metadata["retrieval_sources"], "dense,keyword")
        self.assertIn("dense_score", chunks[0].metadata)
        self.assertIn("keyword_score", chunks[0].metadata)
        self.assertEqual(len({chunk.text for chunk in chunks}), len(chunks))

if __name__ == "__main__":
    suite = unittest.TestSuite()
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(LocalIndexRetrieverTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(KeywordRetrieverTests))
    suite.addTests(unittest.defaultTestLoader.loadTestsFromTestCase(HybridRetrieverTests))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
