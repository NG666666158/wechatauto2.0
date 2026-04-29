from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping

from wechat_ai.config import SUPPORTED_EMBEDDING_PROVIDERS


DEFAULT_PROVIDER = "fake"
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "text-embedding-3-small"
DEFAULT_TIMEOUT = 30.0


@dataclass(frozen=True, slots=True)
class DesktopEmbeddingConfig:
    provider: str = DEFAULT_PROVIDER
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    dimensions: int | None = None
    timeout: float = DEFAULT_TIMEOUT
    api_key_set: bool = False
    api_key_preview: str = ""
    _api_key: str = ""

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any] | None) -> "DesktopEmbeddingConfig":
        data = dict(payload or {})
        api_key = _optional_str(data.get("api_key")) or _optional_str(data.get("_api_key"))
        api_key_set = bool(api_key) or bool(data.get("api_key_set", False))
        api_key_preview = _preview_api_key(api_key) if api_key else _optional_str(data.get("api_key_preview"))
        return cls(
            provider=_normalize_provider(data.get("provider", DEFAULT_PROVIDER)),
            base_url=_non_empty_str(data.get("base_url"), DEFAULT_BASE_URL),
            model=_non_empty_str(data.get("model"), DEFAULT_MODEL),
            dimensions=_parse_dimensions(data.get("dimensions")),
            timeout=_parse_timeout(data.get("timeout", DEFAULT_TIMEOUT)),
            api_key_set=api_key_set,
            api_key_preview=api_key_preview if api_key_set else "",
            _api_key=api_key,
        )

    def apply_patch(self, patch: Mapping[str, Any] | None) -> "DesktopEmbeddingConfig":
        data = dict(patch or {})
        updates: dict[str, Any] = {}
        if "provider" in data:
            updates["provider"] = _normalize_provider(data["provider"])
        if "base_url" in data:
            updates["base_url"] = _non_empty_str(data["base_url"], DEFAULT_BASE_URL)
        if "model" in data:
            updates["model"] = _non_empty_str(data["model"], DEFAULT_MODEL)
        if "dimensions" in data:
            updates["dimensions"] = _parse_dimensions(data["dimensions"])
        if "timeout" in data:
            updates["timeout"] = _parse_timeout(data["timeout"])
        if "api_key" in data:
            api_key = _optional_str(data["api_key"])
            if api_key:
                updates["_api_key"] = api_key
                updates["api_key_set"] = True
                updates["api_key_preview"] = _preview_api_key(api_key)
        return replace(self, **updates)

    def to_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "base_url": self.base_url,
            "model": self.model,
            "dimensions": self.dimensions,
            "timeout": self.timeout,
            "api_key_set": self.api_key_set,
            "api_key_preview": self.api_key_preview,
        }

    def to_storage_dict(self) -> dict[str, object]:
        payload = self.to_dict()
        if self._api_key:
            payload["api_key"] = self._api_key
        return payload

    def to_env_overrides(self) -> dict[str, str]:
        env = {
            "WECHATAUTO_EMBEDDING_PROVIDER": self.provider,
            "WECHATAUTO_EMBEDDING_BASE_URL": self.base_url,
            "WECHATAUTO_EMBEDDING_MODEL": self.model,
            "WECHATAUTO_EMBEDDING_TIMEOUT": _format_float(self.timeout),
        }
        if self.dimensions is not None:
            env["WECHATAUTO_EMBEDDING_DIMENSIONS"] = str(self.dimensions)
        if self._api_key:
            env["WECHATAUTO_EMBEDDING_API_KEY"] = self._api_key
        return env


def _normalize_provider(value: Any) -> str:
    provider = _optional_str(value).lower() or DEFAULT_PROVIDER
    if provider not in SUPPORTED_EMBEDDING_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_EMBEDDING_PROVIDERS))
        raise ValueError(f"Unsupported embedding provider '{provider}'. Supported providers: {supported}")
    return provider


def _parse_dimensions(value: Any) -> int | None:
    raw_value = _optional_str(value)
    if not raw_value:
        return None
    try:
        dimensions = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError("embedding dimensions must be a positive integer") from exc
    if dimensions <= 0:
        raise ValueError("embedding dimensions must be positive")
    return dimensions


def _parse_timeout(value: Any) -> float:
    try:
        timeout = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("embedding timeout must be a positive number") from exc
    if timeout <= 0:
        raise ValueError("embedding timeout must be positive")
    return timeout


def _preview_api_key(api_key: str) -> str:
    if len(api_key) <= 7:
        return "***"
    return f"{api_key[:3]}...{api_key[-4:]}"


def _non_empty_str(value: Any, default: str) -> str:
    return _optional_str(value) or default


def _optional_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _format_float(value: float) -> str:
    return str(int(value)) if value.is_integer() else str(value)
