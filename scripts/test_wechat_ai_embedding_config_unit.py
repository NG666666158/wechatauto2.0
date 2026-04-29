from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from wechat_ai.app.embedding_config import DesktopEmbeddingConfig  # type: ignore  # noqa: E402


class DesktopEmbeddingConfigTests(unittest.TestCase):
    def test_default_config_uses_fake_provider_without_secret(self) -> None:
        config = DesktopEmbeddingConfig.from_dict({})

        self.assertEqual(
            config.to_dict(),
            {
                "provider": "fake",
                "base_url": "https://api.openai.com/v1",
                "model": "text-embedding-3-small",
                "dimensions": None,
                "timeout": 30.0,
                "api_key_set": False,
                "api_key_preview": "",
            },
        )
        self.assertEqual(
            config.to_env_overrides(),
            {
                "WECHATAUTO_EMBEDDING_PROVIDER": "fake",
                "WECHATAUTO_EMBEDDING_BASE_URL": "https://api.openai.com/v1",
                "WECHATAUTO_EMBEDDING_MODEL": "text-embedding-3-small",
                "WECHATAUTO_EMBEDDING_TIMEOUT": "30",
            },
        )

    def test_openai_compatible_config_exports_env_overrides(self) -> None:
        config = DesktopEmbeddingConfig.from_dict(
            {
                "provider": " openai_compatible ",
                "base_url": "https://example.test/v1/",
                "api_key": "dummy-live-secret",
                "model": "embedding-model",
                "dimensions": "1536",
                "timeout": "12",
            }
        )

        self.assertEqual(config.provider, "openai_compatible")
        self.assertEqual(config.dimensions, 1536)
        self.assertEqual(config.timeout, 12.0)
        self.assertEqual(config.api_key_preview, "dum...cret")
        self.assertEqual(
            config.to_env_overrides(),
            {
                "WECHATAUTO_EMBEDDING_PROVIDER": "openai_compatible",
                "WECHATAUTO_EMBEDDING_BASE_URL": "https://example.test/v1/",
                "WECHATAUTO_EMBEDDING_API_KEY": "dummy-live-secret",
                "WECHATAUTO_EMBEDDING_MODEL": "embedding-model",
                "WECHATAUTO_EMBEDDING_TIMEOUT": "12",
                "WECHATAUTO_EMBEDDING_DIMENSIONS": "1536",
            },
        )

    def test_api_key_preview_does_not_expose_full_secret(self) -> None:
        config = DesktopEmbeddingConfig.from_dict({"api_key": "plain-secret-abcd"})

        self.assertTrue(config.api_key_set)
        self.assertEqual(config.api_key_preview, "pla...abcd")
        self.assertNotIn("api_key", config.to_dict())

    def test_blank_api_key_patch_does_not_overwrite_existing_secret(self) -> None:
        config = DesktopEmbeddingConfig.from_dict(
            {
                "provider": "openai_compatible",
                "base_url": "https://example.test/v1",
                "api_key": "dummy-old-abcd",
            }
        )

        patched = config.apply_patch({"model": "new-model", "api_key": ""})

        self.assertEqual(patched.model, "new-model")
        self.assertEqual(patched.api_key_preview, "dum...abcd")
        self.assertEqual(patched.to_env_overrides()["WECHATAUTO_EMBEDDING_API_KEY"], "dummy-old-abcd")

    def test_non_blank_api_key_patch_updates_preview_and_env(self) -> None:
        config = DesktopEmbeddingConfig.from_dict({"api_key": "dummy-old-abcd"})

        patched = config.apply_patch({"api_key": "dummy-new-wxyz"})

        self.assertEqual(patched.api_key_preview, "dum...wxyz")
        self.assertEqual(patched.to_env_overrides()["WECHATAUTO_EMBEDDING_API_KEY"], "dummy-new-wxyz")

    def test_invalid_provider_dimensions_and_timeout_raise(self) -> None:
        invalid_cases = (
            ({"provider": "cloud"}, "provider"),
            ({"dimensions": "0"}, "dimensions"),
            ({"dimensions": "-1"}, "dimensions"),
            ({"dimensions": "abc"}, "dimensions"),
            ({"timeout": "0"}, "timeout"),
            ({"timeout": "-1"}, "timeout"),
            ({"timeout": "abc"}, "timeout"),
        )

        for payload, message in invalid_cases:
            with self.subTest(payload=payload):
                with self.assertRaisesRegex(ValueError, message):
                    DesktopEmbeddingConfig.from_dict(payload)


if __name__ == "__main__":
    unittest.main()
