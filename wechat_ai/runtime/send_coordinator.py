from __future__ import annotations

import threading
from typing import Any, Callable
from uuid import uuid4

from wechat_ai.storage.runtime_state import RuntimeStateStore


class UiActionLock:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._owner: str | None = None

    def acquire(self, owner: str, timeout: float = 30.0) -> bool:
        acquired = self._lock.acquire(timeout=max(float(timeout), 0.0))
        if acquired:
            self._owner = owner
        return acquired

    def release(self, owner: str) -> None:
        if self._owner == owner:
            self._owner = None
            self._lock.release()

    def current_owner(self) -> str | None:
        return self._owner


class SendCoordinator:
    def __init__(
        self,
        *,
        store: RuntimeStateStore,
        sender: Callable[..., dict[str, Any] | None],
        confirmer: Callable[..., object] | None = None,
        precheck: Callable[..., dict[str, Any] | bool] | None = None,
        on_uncertain: Callable[[dict[str, Any], dict[str, Any]], None] | None = None,
        ui_lock: UiActionLock | None = None,
        lock_timeout_seconds: float = 30.0,
    ) -> None:
        self.store = store
        self.sender = sender
        self.confirmer = confirmer
        self.precheck = precheck
        self.on_uncertain = on_uncertain
        self.ui_lock = ui_lock or UiActionLock()
        self.lock_timeout_seconds = lock_timeout_seconds

    def send_reply(
        self,
        *,
        conversation_id: str,
        target_title: str,
        text: str,
        is_group: bool = False,
        reply_job_id: str | None = None,
    ) -> dict[str, Any]:
        safe_reply_job_id = reply_job_id or f"manual_{uuid4().hex}"
        send_job = self.store.create_send_job(
            reply_job_id=safe_reply_job_id,
            conversation_id=conversation_id,
            target_title=target_title,
            content=text,
        )
        send_job_id = str(send_job["send_job_id"])
        current_status = str(send_job.get("status", "PENDING"))
        if current_status == "SENT_CONFIRMED":
            return {"status": "already_sent", "send_job_id": send_job_id, "sent": False, "confirmed": True}
        if current_status == "SEND_UNCERTAIN":
            return {"status": "send_uncertain", "send_job_id": send_job_id, "sent": True, "confirmed": False}
        if current_status in {"SENDING", "VERIFYING", "LOCKED", "PRECHECKING"}:
            return {"status": "send_in_progress", "send_job_id": send_job_id, "sent": False, "confirmed": False}

        if not self.ui_lock.acquire(send_job_id, timeout=self.lock_timeout_seconds):
            updated = self.store.mark_send_job(send_job_id, status="SEND_FAILED", lock_owner=None)
            return {
                "status": "send_failed",
                "send_job_id": send_job_id,
                "sent": False,
                "confirmed": False,
                "reason_code": "UI_LOCK_TIMEOUT",
                "send_job": updated,
            }

        attempt: dict[str, Any] | None = None
        try:
            self.store.mark_send_job(send_job_id, status="LOCKED", lock_owner=send_job_id)
            precheck = self._run_precheck(
                conversation_id=conversation_id,
                target_title=target_title,
                text=text,
                is_group=is_group,
                send_job_id=send_job_id,
            )
            if not precheck["ok"]:
                reason_code = str(precheck.get("reason_code") or "PRECHECK_FAILED")
                self.store.mark_send_job(
                    send_job_id,
                    status="SEND_FAILED",
                    lock_owner=None,
                    confirmation_result={"ok": False, "reason_code": reason_code, "phase": "precheck"},
                )
                return {
                    "status": "send_failed",
                    "send_job_id": send_job_id,
                    "sent": False,
                    "confirmed": False,
                    "reason_code": reason_code,
                }

            self.store.mark_send_job(send_job_id, status="SENDING", lock_owner=send_job_id)
            attempt = self.store.create_send_attempt(send_job_id, status="SENDING")
            try:
                send_result = self.sender(conversation_id=conversation_id, target_title=target_title, text=text, is_group=is_group)
            except Exception as exc:
                reason = f"{type(exc).__name__}: {exc}"
                self.store.finish_send_attempt(
                    str(attempt["attempt_id"]),
                    status="SEND_FAILED",
                    error_code="SEND_FAILED",
                    error_message=reason,
                )
                self.store.mark_send_job(
                    send_job_id,
                    status="SEND_FAILED",
                    lock_owner=None,
                    confirmation_result={"ok": False, "reason_code": "SEND_FAILED", "reason": reason},
                )
                return {
                    "status": "send_failed",
                    "send_job_id": send_job_id,
                    "sent": False,
                    "confirmed": False,
                    "reason_code": "SEND_FAILED",
                    "reason": reason,
                }

            normalized_send_result = send_result if isinstance(send_result, dict) else {}
            self.store.mark_send_job(send_job_id, status="VERIFYING", lock_owner=send_job_id)
            confirmed, confirmation_detail = self._confirm(
                conversation_id=conversation_id,
                target_title=target_title,
                text=text,
                is_group=is_group,
                send_result=normalized_send_result,
            )
            if confirmed:
                screenshot_evidence = _confirmation_screenshots(confirmation_detail)
                self.store.finish_send_attempt(
                    str(attempt["attempt_id"]),
                    status="SENT_CONFIRMED",
                    **screenshot_evidence,
                )
                self.store.mark_send_job(
                    send_job_id,
                    status="SENT_CONFIRMED",
                    lock_owner=None,
                    confirmation_result={"ok": True, **confirmation_detail},
                    **screenshot_evidence,
                )
                return {
                    "status": "sent_confirmed",
                    "send_job_id": send_job_id,
                    "sent": True,
                    "confirmed": True,
                    "send_result": normalized_send_result,
                }

            screenshot_evidence = _confirmation_screenshots(confirmation_detail)
            self.store.finish_send_attempt(
                str(attempt["attempt_id"]),
                status="SEND_UNCERTAIN",
                error_code="SEND_NOT_CONFIRMED",
                error_message=str(confirmation_detail.get("reason", "")),
                **screenshot_evidence,
            )
            updated_send_job = self.store.mark_send_job(
                send_job_id,
                status="SEND_UNCERTAIN",
                lock_owner=None,
                confirmation_result={"ok": False, "reason_code": "SEND_NOT_CONFIRMED", **confirmation_detail},
                **screenshot_evidence,
            )
            result = {
                "status": "send_uncertain",
                "send_job_id": send_job_id,
                "sent": True,
                "confirmed": False,
                "reason_code": "SEND_NOT_CONFIRMED",
                "send_result": normalized_send_result,
            }
            self._notify_uncertain(updated_send_job, result)
            return result
        finally:
            self.ui_lock.release(send_job_id)

    def _run_precheck(self, **kwargs: Any) -> dict[str, Any]:
        if self.precheck is None:
            return {"ok": True}
        result = self.precheck(**kwargs)
        if isinstance(result, dict):
            return {"ok": bool(result.get("ok", False)), **result}
        return {"ok": bool(result)}

    def _confirm(self, **kwargs: Any) -> tuple[bool, dict[str, Any]]:
        if self.confirmer is None:
            return True, {"confirmation_required": False}
        try:
            result = self.confirmer(**kwargs)
        except Exception as exc:
            reason = f"{type(exc).__name__}: {exc}"
            return False, {"reason": reason, "confirmation": {"ok": False, "reason": reason}, "confirmation_required": True}
        if isinstance(result, dict):
            detail = {"confirmation": result, "confirmation_required": True}
            if "reason" in result:
                detail["reason"] = str(result.get("reason") or "")
            return bool(result.get("ok", result.get("confirmed", False))), detail
        confirmed = bool(result)
        detail = {"confirmation": {"ok": confirmed}, "confirmation_required": True}
        if not confirmed:
            detail["reason"] = "confirmation_false"
            detail["confirmation"]["reason"] = "confirmation_false"
        return confirmed, detail

    def _notify_uncertain(self, send_job: dict[str, Any], result: dict[str, Any]) -> None:
        if self.on_uncertain is None:
            return
        try:
            self.on_uncertain(send_job, result)
        except Exception:
            return


def _confirmation_screenshots(confirmation_detail: dict[str, Any]) -> dict[str, str]:
    confirmation = confirmation_detail.get("confirmation")
    if not isinstance(confirmation, dict):
        confirmation = {}
    screenshots: dict[str, str] = {}
    for key in ("before_screenshot", "after_screenshot"):
        value = confirmation_detail.get(key, confirmation.get(key))
        if value:
            screenshots[key] = str(value)
    return screenshots
