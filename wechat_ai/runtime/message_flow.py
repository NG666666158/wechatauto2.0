from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any


@dataclass(slots=True)
class UnreadMessageRecord:
    text: str
    sender_name: str = ""
    signature_key: str = ""


def normalize_dedupe_part(value: object) -> str:
    return " ".join(str(value or "").replace("\u2005", " ").replace("\xa0", " ").split())


def normalize_group_sender_name(chat_id: str, sender_name: str | None) -> str:
    normalized_chat_id = str(chat_id or "").strip()
    normalized_sender = str(sender_name or "").strip()
    return normalized_sender or normalized_chat_id


def build_merged_message(messages: list[str]) -> str:
    return "\n".join(message.strip() for message in messages if message.strip())


def order_unread_messages(unread_messages: list[str], contexts: list[str]) -> list[str]:
    cleaned_messages = [message.strip() for message in unread_messages if isinstance(message, str) and message.strip()]
    if len(cleaned_messages) <= 1:
        return cleaned_messages

    context_timeline = [message.strip() for message in contexts if isinstance(message, str) and message.strip()]
    if len(context_timeline) < len(cleaned_messages):
        return cleaned_messages

    remaining = Counter(cleaned_messages)
    ordered_messages: list[str] = []
    for context_message in context_timeline:
        if remaining.get(context_message, 0) <= 0:
            continue
        ordered_messages.append(context_message)
        remaining[context_message] -= 1

    if len(ordered_messages) != len(cleaned_messages):
        return cleaned_messages
    return ordered_messages


def normalize_unread_message_record(raw_message: object) -> UnreadMessageRecord | None:
    if isinstance(raw_message, str):
        text = raw_message.strip()
        return UnreadMessageRecord(text=text, signature_key=text) if text else None

    if isinstance(raw_message, dict):
        text_value = (
            raw_message.get("text")
            or raw_message.get("message")
            or raw_message.get("content")
            or raw_message.get("message_content")
        )
        text = str(text_value or "").strip()
        if not text:
            return None
        sender_value = (
            raw_message.get("sender_name")
            or raw_message.get("sender")
            or raw_message.get("nickname")
            or raw_message.get("from")
        )
        sender_name = str(sender_value or "").strip()
        runtime_value = raw_message.get("runtime_id") or raw_message.get("message_id") or raw_message.get("signature")
        signature_key = str(runtime_value or text).strip() or text
        return UnreadMessageRecord(text=text, sender_name=sender_name, signature_key=signature_key)

    if isinstance(raw_message, (tuple, list)) and len(raw_message) >= 2:
        sender_name = str(raw_message[0] or "").strip()
        text = str(raw_message[1] or "").strip()
        if not text:
            return None
        signature_key = str(raw_message[2] if len(raw_message) >= 3 else text).strip() or text
        return UnreadMessageRecord(text=text, sender_name=sender_name, signature_key=signature_key)

    return None


def order_unread_message_records(
    records: list[UnreadMessageRecord],
    contexts: list[str],
) -> list[UnreadMessageRecord]:
    if len(records) <= 1:
        return records

    ordered_texts = order_unread_messages([record.text for record in records], contexts)
    if ordered_texts == [record.text for record in records]:
        return records

    remaining_by_text: dict[str, list[UnreadMessageRecord]] = {}
    for record in records:
        remaining_by_text.setdefault(record.text, []).append(record)

    ordered_records: list[UnreadMessageRecord] = []
    for text in ordered_texts:
        candidates = remaining_by_text.get(text) or []
        if not candidates:
            return records
        ordered_records.append(candidates.pop(0))
    return ordered_records if len(ordered_records) == len(records) else records


def message_dedupe_signature(
    *,
    session_name: str,
    text: str,
    is_group: bool,
    sender_name: str | None = None,
) -> str:
    chat_prefix = "group" if is_group else "friend"
    normalized_session = normalize_dedupe_part(session_name)
    normalized_text = normalize_dedupe_part(text)
    normalized_sender = normalize_dedupe_part(sender_name if is_group else session_name)
    if is_group:
        normalized_sender = normalized_sender or normalized_session
    return f"{chat_prefix}:{normalized_session}\0{normalized_sender}\0{normalized_text}"


def legacy_unread_text_signature(session_name: str, text: str) -> str:
    return f"{session_name}\0unread\0{text}"


def should_flush_active_pending(
    *,
    active_pending_session: str | None,
    active_pending_messages: list[str],
    now: float,
    current_session_name: str | None = None,
    active_pending_deadline: float | None = None,
    force: bool = False,
) -> bool:
    if not active_pending_session or not active_pending_messages:
        return False
    if force:
        return True
    if current_session_name and current_session_name != active_pending_session:
        return True
    return active_pending_deadline is not None and now >= active_pending_deadline


def pending_state_is_empty(active_pending_session: str | None, active_pending_messages: list[str]) -> bool:
    return not active_pending_session or not active_pending_messages
