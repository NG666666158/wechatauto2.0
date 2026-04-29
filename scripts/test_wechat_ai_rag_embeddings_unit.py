from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


from wechat_ai.config import EmbeddingSettings  # type: ignore  # noqa: E402
from wechat_ai.rag.embeddings import OpenAICompatibleEmbeddings, build_embeddings  # type: ignore  # noqa: E402


class OpenAICompatibleEmbeddingsTests(unittest.TestCase):
    def test_embed_documents_sends_openai_compatible_payload(self) -> None:
        calls: list[dict[str, Any]] = []

        def transport(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
            calls.append({"url": url, "payload": payload, "headers": headers, "timeout": timeout})
            return {
                "data": [
                    {"index": 0, "embedding": [0.1, 0.2, 0.3]},
                    {"index": 1, "embedding": [0.4, 0.5, 0.6]},
                ]
            }

        provider = OpenAICompatibleEmbeddings(
            base_url="https://example.test/v1/",
            api_key="dummy-test-key",
            model="embedding-model",
            timeout=7,
            dimensions=3,
            transport=transport,
        )

        vectors = provider.embed_documents(["alpha", "beta"])

        self.assertEqual(vectors, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])
        self.assertEqual(calls[0]["url"], "https://example.test/v1/embeddings")
        self.assertEqual(
            calls[0]["payload"],
            {
                "model": "embedding-model",
                "input": ["alpha", "beta"],
                "dimensions": 3,
            },
        )
        self.assertEqual(calls[0]["headers"]["Authorization"], "Bearer dummy-test-key")
        self.assertEqual(calls[0]["timeout"], 7.0)

    def test_embed_query_returns_single_vector(self) -> None:
        def transport(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
            return {"data": [{"embedding": [1, 2, 3]}]}

        provider = OpenAICompatibleEmbeddings(
            base_url="https://example.test/v1",
            api_key="dummy-test-key",
            model="embedding-model",
            transport=transport,
        )

        self.assertEqual(provider.embed_query("hello"), [1.0, 2.0, 3.0])

    def test_embed_documents_rejects_malformed_response(self) -> None:
        def transport(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
            return {"data": [{"embedding": "not-a-vector"}]}

        provider = OpenAICompatibleEmbeddings(
            base_url="https://example.test/v1",
            api_key="dummy-test-key",
            model="embedding-model",
            transport=transport,
        )

        with self.assertRaises(ValueError):
            provider.embed_documents(["alpha"])

    def test_embed_documents_rejects_unexpected_dimensions(self) -> None:
        def transport(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: float) -> dict[str, Any]:
            return {"data": [{"embedding": [0.1, 0.2]}]}

        provider = OpenAICompatibleEmbeddings(
            base_url="https://example.test/v1",
            api_key="dummy-test-key",
            model="embedding-model",
            dimensions=3,
            transport=transport,
        )

        with self.assertRaises(ValueError):
            provider.embed_documents(["alpha"])

    def test_build_embeddings_uses_openai_compatible_settings(self) -> None:
        settings = EmbeddingSettings(
            provider="openai_compatible",
            base_url="https://example.test/v1",
            api_key="dummy-test-key",
            model="embedding-model",
            timeout=5,
            dimensions=3,
        )

        provider = build_embeddings(settings)

        self.assertIsInstance(provider, OpenAICompatibleEmbeddings)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(OpenAICompatibleEmbeddingsTests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    print(json.dumps({"ok": result.wasSuccessful()}, ensure_ascii=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
