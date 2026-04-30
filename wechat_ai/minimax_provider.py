from __future__ import annotations

import json
import os
import time
import urllib.request
from collections.abc import Callable
from urllib.error import HTTPError, URLError


Transport = Callable[[str, dict[str, str], dict[str, object], int], dict[str, object]]
SleepFn = Callable[[float], None]
TRANSIENT_HTTP_STATUS_CODES = frozenset({408, 409, 425, 429, 500, 502, 503, 504, 529})


def _default_transport(url: str, headers: dict[str, str], payload: dict[str, object], timeout: int) -> dict[str, object]:
    request = urllib.request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    opener = (
        urllib.request.build_opener()
        if _use_system_proxy()
        else urllib.request.build_opener(urllib.request.ProxyHandler({}))
    )
    with opener.open(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _use_system_proxy() -> bool:
    raw_value = os.getenv("MINIMAX_USE_SYSTEM_PROXY") or os.getenv("WECHAT_AI_USE_SYSTEM_PROXY") or ""
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


class MiniMaxProvider:
    def __init__(
        self,
        api_key: str,
        api_url: str = "https://api.minimaxi.com/v1/text/chatcompletion_v2",
        timeout: int = 30,
        transport: Transport | None = None,
        retry_attempts: int = 2,
        retry_backoff_seconds: float = 1.0,
        sleep_fn: SleepFn = time.sleep,
    ) -> None:
        self.api_key = api_key
        self.api_url = api_url
        self.timeout = timeout
        self.transport = transport or _default_transport
        self.retry_attempts = max(int(retry_attempts), 0)
        self.retry_backoff_seconds = max(float(retry_backoff_seconds), 0.0)
        self.sleep_fn = sleep_fn

    def complete(self, system_prompt: str, user_prompt: str, model: str | None = None) -> str:
        payload = {
            "model": model or "MiniMax-M2.5",
            "messages": [
                {"role": "system", "name": "System", "content": system_prompt},
                {"role": "user", "name": "User", "content": user_prompt},
            ],
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        response = self._request_with_retries(headers, payload)
        try:
            return str(response["choices"][0]["message"]["content"]).strip()
        except Exception as exc:  # pragma: no cover
            raise ValueError(f"Invalid MiniMax response: {response}") from exc

    def _request_with_retries(self, headers: dict[str, str], payload: dict[str, object]) -> dict[str, object]:
        last_error: Exception | None = None
        for attempt in range(self.retry_attempts + 1):
            try:
                return self.transport(self.api_url, headers, payload, self.timeout)
            except Exception as exc:
                last_error = exc
                if attempt >= self.retry_attempts or not _is_transient_error(exc):
                    raise
                if self.retry_backoff_seconds > 0:
                    self.sleep_fn(self.retry_backoff_seconds * (attempt + 1))
        if last_error is not None:  # pragma: no cover
            raise last_error
        raise RuntimeError("MiniMax request failed without an exception")  # pragma: no cover


def _is_transient_error(exc: Exception) -> bool:
    if isinstance(exc, HTTPError):
        return int(exc.code) in TRANSIENT_HTTP_STATUS_CODES
    if isinstance(exc, (TimeoutError, URLError)):
        return True
    return False
