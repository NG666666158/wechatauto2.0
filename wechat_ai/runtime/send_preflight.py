from __future__ import annotations

from typing import Any, Mapping


def evaluate_conversation_send_preflight(
    *,
    conversation_id: str,
    text: str,
    control: Mapping[str, Any],
    safety_allowed: bool = True,
    safety_reason_code: str = "",
    safety_reason: str = "",
) -> dict[str, object]:
    normalized_id = str(conversation_id).strip()
    if not str(text).strip():
        return _blocked_send("EMPTY_TEXT", "\u56de\u590d\u5185\u5bb9\u4e0d\u80fd\u4e3a\u7a7a\u3002", conversation_id=normalized_id)
    if bool(control.get("human_takeover", False)):
        return _blocked_send("HUMAN_TAKEOVER", "\u8be5\u4f1a\u8bdd\u5df2\u7531\u4eba\u5de5\u63a5\u7ba1\u3002", conversation_id=normalized_id)
    if bool(control.get("paused", False)):
        return _blocked_send("CONVERSATION_PAUSED", "\u8be5\u4f1a\u8bdd\u5df2\u6682\u505c\u81ea\u52a8\u56de\u590d\u3002", conversation_id=normalized_id)
    if bool(control.get("blacklisted", False)):
        return _blocked_send("BLACKLISTED", "\u8be5\u4f1a\u8bdd\u5728\u9ed1\u540d\u5355\u4e2d\u3002", conversation_id=normalized_id)
    if not safety_allowed:
        return _blocked_send(
            str(safety_reason_code).strip() or "SAFETY_REVIEW_REQUIRED",
            str(safety_reason).strip() or "SAFETY_REVIEW_REQUIRED",
            conversation_id=normalized_id,
        )
    return {
        "allowed": True,
        "reason_code": "",
        "reason": "",
        "conversation_id": normalized_id,
    }


def evaluate_send_coordinator_precheck(
    *,
    has_unresolved_uncertain_send: bool,
    knowledge_precheck: Mapping[str, Any] | None = None,
) -> dict[str, object]:
    if has_unresolved_uncertain_send:
        return {
            "ok": False,
            "reason_code": "UNRESOLVED_SEND_UNCERTAIN",
            "reason": "conversation has an unresolved SEND_UNCERTAIN send job",
        }
    if knowledge_precheck is not None and not bool(knowledge_precheck.get("ok", False)):
        return dict(knowledge_precheck)
    return {"ok": True}


def _blocked_send(reason_code: str, reason: str, *, conversation_id: str) -> dict[str, object]:
    return {
        "allowed": False,
        "reason_code": reason_code,
        "reason": reason,
        "conversation_id": conversation_id,
    }
