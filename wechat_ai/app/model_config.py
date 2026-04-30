from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any, Mapping


DEFAULT_MODEL_PROVIDER = "minimax"
DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7"
DEFAULT_MINIMAX_API_URL = "https://api.minimaxi.com/v1/text/chatcompletion_v2"
DEFAULT_TIMEOUT = 30.0


@dataclass(frozen=True, slots=True)
class MiniMaxModelConfig:
    model: str = DEFAULT_MINIMAX_MODEL
    api_url: str = DEFAULT_MINIMAX_API_URL
    timeout: float = DEFAULT_TIMEOUT
    api_key_set: bool = False
    api_key_preview: str = ""
    _api_key: str = ""

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any] | None) -> "MiniMaxModelConfig":
        data = dict(payload or {})
        api_key = _optional_str(data.get("api_key")) or _optional_str(data.get("_api_key"))
        api_key_set = bool(api_key) or bool(data.get("api_key_set", False))
        api_key_preview = _preview_api_key(api_key) if api_key else _optional_str(data.get("api_key_preview"))
        return cls(
            model=_non_empty_str(data.get("model"), DEFAULT_MINIMAX_MODEL),
            api_url=_non_empty_str(data.get("api_url"), DEFAULT_MINIMAX_API_URL),
            timeout=_parse_timeout(data.get("timeout", DEFAULT_TIMEOUT)),
            api_key_set=api_key_set,
            api_key_preview=api_key_preview if api_key_set else "",
            _api_key=api_key,
        )

    def apply_patch(self, patch: Mapping[str, Any] | None) -> "MiniMaxModelConfig":
        data = dict(patch or {})
        updates: dict[str, Any] = {}
        if "model" in data:
            updates["model"] = _non_empty_str(data["model"], DEFAULT_MINIMAX_MODEL)
        if "api_url" in data:
            updates["api_url"] = _non_empty_str(data["api_url"], DEFAULT_MINIMAX_API_URL)
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
            "model": self.model,
            "api_url": self.api_url,
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
            "MINIMAX_MODEL": self.model,
            "MINIMAX_API_URL": self.api_url,
            "MINIMAX_TIMEOUT": _format_float(self.timeout),
        }
        if self._api_key:
            env["MINIMAX_API_KEY"] = self._api_key
        return env


@dataclass(frozen=True, slots=True)
class DesktopModelConfig:
    provider: str = DEFAULT_MODEL_PROVIDER
    minimax: MiniMaxModelConfig = MiniMaxModelConfig()

    @classmethod
    def from_dict(cls, payload: Mapping[str, Any] | None) -> "DesktopModelConfig":
        data = dict(payload or {})
        return cls(
            provider=_normalize_provider(data.get("provider", DEFAULT_MODEL_PROVIDER)),
            minimax=MiniMaxModelConfig.from_dict(data.get("minimax") if isinstance(data.get("minimax"), Mapping) else {}),
        )

    def apply_patch(self, patch: Mapping[str, Any] | None) -> "DesktopModelConfig":
        data = dict(patch or {})
        provider = self.provider
        if "provider" in data:
            provider = _normalize_provider(data["provider"])
        minimax = self.minimax
        if isinstance(data.get("minimax"), Mapping):
            minimax = self.minimax.apply_patch(data["minimax"])
        return replace(self, provider=provider, minimax=minimax)

    def to_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "minimax": self.minimax.to_dict(),
        }

    def to_storage_dict(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "minimax": self.minimax.to_storage_dict(),
        }

    def configured(self) -> bool:
        return self.provider == "minimax" and bool(self.minimax._api_key)


def _normalize_provider(value: Any) -> str:
    provider = _optional_str(value).lower() or DEFAULT_MODEL_PROVIDER
    if provider != "minimax":
        raise ValueError("Only MiniMax model provider is supported in this version")
    return provider


def _parse_timeout(value: Any) -> float:
    try:
        timeout = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("model timeout must be a positive number") from exc
    if timeout <= 0:
        raise ValueError("model timeout must be positive")
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
