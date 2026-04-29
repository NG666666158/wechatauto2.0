from __future__ import annotations

import json
import threading
from collections.abc import Mapping
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

from wechat_ai.logging_utils import utc_timestamp


_WRITE_LOCK = threading.Lock()


class KnowledgeTaskStore:
    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def append_task(
        self,
        *,
        task_type: str,
        title: str,
        status: str = "pending",
        stage: str = "queued",
        summary: str = "",
        error: str = "",
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = utc_timestamp()
        task = {
            "id": f"task_{uuid4().hex}",
            "type": _clean_text(task_type, fallback="import"),
            "title": _clean_text(title, fallback="Untitled task"),
            "status": _clean_text(status, fallback="pending"),
            "stage": _clean_text(stage, fallback="queued"),
            "created_at": now,
            "updated_at": now,
            "summary": str(summary or ""),
            "error": str(error or ""),
            "metadata": _json_safe_dict(metadata),
        }
        with _WRITE_LOCK:
            tasks = self._load_tasks()
            tasks.append(task)
            self._save_tasks(tasks)
        return dict(task)

    def update_task(
        self,
        task_id: str,
        *,
        status: str | None = None,
        stage: str | None = None,
        summary: str | None = None,
        error: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        normalized_id = str(task_id).strip()
        if not normalized_id:
            return None

        with _WRITE_LOCK:
            tasks = self._load_tasks()
            for index, task in enumerate(tasks):
                if task.get("id") != normalized_id:
                    continue
                updated = dict(task)
                if status is not None:
                    updated["status"] = _clean_text(status, fallback=str(updated.get("status") or "pending"))
                if stage is not None:
                    updated["stage"] = _clean_text(stage, fallback=str(updated.get("stage") or "queued"))
                if summary is not None:
                    updated["summary"] = str(summary)
                if error is not None:
                    updated["error"] = str(error)
                if metadata is not None:
                    current_metadata = updated.get("metadata")
                    merged = dict(current_metadata) if isinstance(current_metadata, dict) else {}
                    merged.update(_json_safe_dict(metadata))
                    updated["metadata"] = merged
                updated["updated_at"] = _timestamp_after(str(updated.get("updated_at") or ""))
                tasks[index] = updated
                self._save_tasks(tasks)
                return dict(updated)
        return None

    def advance_task(
        self,
        task_id: str,
        stage: str,
        *,
        summary: str | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        return self.update_task(task_id, stage=stage, summary=summary, metadata=metadata)

    def recent_tasks(self, limit: int = 20) -> list[dict[str, Any]]:
        if limit <= 0:
            return []
        tasks = self._load_tasks()
        ordered = sorted(
            tasks,
            key=lambda task: str(task.get("updated_at") or task.get("created_at") or ""),
            reverse=True,
        )
        return [dict(task) for task in ordered[:limit]]

    def _load_tasks(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            return []

        raw_tasks: Any
        if isinstance(payload, dict):
            raw_tasks = payload.get("tasks", [])
        else:
            raw_tasks = payload
        if not isinstance(raw_tasks, list):
            return []

        tasks: list[dict[str, Any]] = []
        for item in raw_tasks:
            if not isinstance(item, dict):
                continue
            normalized = _normalize_task(item)
            if normalized is not None:
                tasks.append(normalized)
        return tasks

    def _save_tasks(self, tasks: list[Mapping[str, Any]]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"tasks": list(tasks)}
        self.path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _normalize_task(item: Mapping[str, Any]) -> dict[str, Any] | None:
    task_id = str(item.get("id") or "").strip()
    if not task_id:
        return None
    created_at = str(item.get("created_at") or item.get("updated_at") or utc_timestamp())
    updated_at = str(item.get("updated_at") or created_at)
    return {
        "id": task_id,
        "type": _clean_text(item.get("type"), fallback="import"),
        "title": _clean_text(item.get("title"), fallback="Untitled task"),
        "status": _clean_text(item.get("status"), fallback="pending"),
        "stage": _normalize_stage(item),
        "created_at": created_at,
        "updated_at": updated_at,
        "summary": str(item.get("summary") or ""),
        "error": str(item.get("error") or ""),
        "metadata": _json_safe_dict(item.get("metadata") if isinstance(item.get("metadata"), Mapping) else None),
    }


def _normalize_stage(item: Mapping[str, Any]) -> str:
    if "stage" in item:
        return _clean_text(item.get("stage"), fallback="queued")
    status = _clean_text(item.get("status"), fallback="pending").lower()
    if status in {"completed", "complete", "done", "success", "succeeded"}:
        return "accept"
    return "queued"


def _clean_text(value: Any, *, fallback: str) -> str:
    text = str(value or "").strip()
    return text or fallback


def _json_safe_dict(value: Mapping[str, Any] | None) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        return {}
    return {str(key): _json_safe(item) for key, item in value.items()}


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return _json_safe_dict(value)
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]
    return str(value)


def _timestamp_after(previous: str) -> str:
    current = utc_timestamp()
    if not previous or current > previous:
        return current
    try:
        previous_dt = datetime.fromisoformat(previous.replace("Z", "+00:00"))
    except ValueError:
        return current
    return (previous_dt + timedelta(microseconds=1)).isoformat().replace("+00:00", "Z")
