from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable
from uuid import uuid4

from wechat_ai.logging_utils import utc_timestamp


TERMINAL_SEND_STATUSES = {"SENT_CONFIRMED", "SEND_FAILED", "SEND_UNCERTAIN", "CANCELLED"}
INCOMPLETE_SEND_STATUSES = {"LOCKED", "PRECHECKING", "SENDING", "VERIFYING"}


class RuntimeStateStore:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._migrate()
        self.recover_incomplete_jobs()

    def record_message_event(
        self,
        *,
        conversation_id: str,
        conversation_title: str = "",
        sender_name: str = "",
        sender_role: str = "user",
        content: str,
        message_type: str = "text",
        source: str = "unknown",
        signature: str | None = None,
        confidence: float = 1.0,
        screenshot_path: str | None = None,
        ocr_raw: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        now = utc_timestamp()
        safe_signature = signature or self.message_signature(
            conversation_id=conversation_id,
            sender_name=sender_name,
            content=content,
            source=source,
        )
        with self._connect() as conn:
            existing = self._fetch_one(conn, "SELECT * FROM message_events WHERE signature = ?", (safe_signature,))
            if existing:
                return existing
            event_id = f"evt_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO message_events (
                    event_id, conversation_id, conversation_title, sender_name, sender_role,
                    content, message_type, source, signature, confidence, screenshot_path,
                    ocr_raw, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    str(conversation_id).strip(),
                    str(conversation_title).strip(),
                    str(sender_name).strip(),
                    str(sender_role).strip() or "user",
                    str(content),
                    str(message_type).strip() or "text",
                    str(source).strip() or "unknown",
                    safe_signature,
                    float(confidence),
                    screenshot_path,
                    _json_dumps(ocr_raw or {}),
                    now,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM message_events WHERE event_id = ?", (event_id,))

    def create_reply_job(
        self,
        *,
        conversation_id: str,
        trigger_event_ids: Iterable[str],
        input_text: str,
        draft_reply: str | None = None,
        status: str = "CREATED",
        risk_level: str = "LOW",
        need_human_review: bool = False,
        context_snapshot_id: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        event_ids = [str(value).strip() for value in trigger_event_ids if str(value).strip()]
        safe_key = idempotency_key or self.reply_idempotency_key(conversation_id, event_ids)
        now = utc_timestamp()
        with self._connect() as conn:
            existing = self._fetch_one(conn, "SELECT * FROM reply_jobs WHERE idempotency_key = ?", (safe_key,))
            if existing:
                return existing
            reply_job_id = f"reply_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO reply_jobs (
                    reply_job_id, conversation_id, trigger_event_ids, input_text,
                    context_snapshot_id, status, draft_reply, risk_level,
                    need_human_review, idempotency_key, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reply_job_id,
                    str(conversation_id).strip(),
                    _json_dumps(event_ids),
                    str(input_text),
                    context_snapshot_id,
                    str(status).strip() or "CREATED",
                    draft_reply,
                    str(risk_level).strip() or "LOW",
                    1 if need_human_review else 0,
                    safe_key,
                    now,
                    now,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM reply_jobs WHERE reply_job_id = ?", (reply_job_id,))

    def get_reply_job(self, reply_job_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = self._fetch_one(conn, "SELECT * FROM reply_jobs WHERE reply_job_id = ?", (reply_job_id,))
        if not row:
            raise KeyError(f"reply job not found: {reply_job_id}")
        return row

    def mark_reply_job(
        self,
        reply_job_id: str,
        *,
        status: str,
        draft_reply: str | None = None,
        review_reason: str | None = None,
        reviewed_by: str | None = None,
    ) -> dict[str, Any]:
        normalized_status = str(status).strip()
        reviewed_at = utc_timestamp() if normalized_status in {"APPROVED", "CANCELLED"} else None
        with self._connect() as conn:
            current = self._fetch_one(conn, "SELECT * FROM reply_jobs WHERE reply_job_id = ?", (reply_job_id,))
            if not current:
                raise KeyError(f"reply job not found: {reply_job_id}")
            conn.execute(
                """
                UPDATE reply_jobs
                SET status = ?,
                    draft_reply = COALESCE(?, draft_reply),
                    review_reason = COALESCE(?, review_reason),
                    reviewed_by = COALESCE(?, reviewed_by),
                    reviewed_at = COALESCE(?, reviewed_at),
                    updated_at = ?
                WHERE reply_job_id = ?
                """,
                (
                    normalized_status,
                    draft_reply,
                    review_reason,
                    reviewed_by,
                    reviewed_at,
                    utc_timestamp(),
                    reply_job_id,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM reply_jobs WHERE reply_job_id = ?", (reply_job_id,))

    def create_send_job(
        self,
        *,
        reply_job_id: str,
        conversation_id: str,
        target_title: str,
        content: str,
        status: str = "PENDING",
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        safe_key = idempotency_key or self.send_idempotency_key(reply_job_id, content)
        now = utc_timestamp()
        with self._connect() as conn:
            existing = self._fetch_one(conn, "SELECT * FROM send_jobs WHERE idempotency_key = ?", (safe_key,))
            if existing:
                return existing
            send_job_id = f"send_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO send_jobs (
                    send_job_id, reply_job_id, conversation_id, target_title, content,
                    status, idempotency_key, lock_owner, before_screenshot,
                    after_screenshot, confirmation_result, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
                """,
                (
                    send_job_id,
                    str(reply_job_id).strip(),
                    str(conversation_id).strip(),
                    str(target_title).strip(),
                    str(content),
                    str(status).strip() or "PENDING",
                    safe_key,
                    now,
                    now,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))

    def resolve_uncertain_send_job(
        self,
        send_job_id: str,
        *,
        resolution: str,
        reason: str | None = None,
        reviewed_by: str | None = None,
    ) -> dict[str, Any]:
        normalized_resolution = str(resolution).strip().lower()
        if normalized_resolution not in {"confirmed", "failed"}:
            raise ValueError("resolution must be confirmed or failed")
        next_status = "SENT_CONFIRMED" if normalized_resolution == "confirmed" else "SEND_FAILED"
        with self._connect() as conn:
            current = self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))
            if not current:
                raise KeyError(f"send job not found: {send_job_id}")
            if current.get("status") != "SEND_UNCERTAIN":
                raise ValueError(f"send job must be SEND_UNCERTAIN to resolve manually: {send_job_id}")
            reviewer = str(reviewed_by or "operator").strip() or "operator"
            confirmation_result = {
                "source": "manual",
                "resolution": normalized_resolution,
                "reason": str(reason or ""),
                "reviewed_by": reviewer,
                "operator": reviewer,
                "resolved_at": utc_timestamp(),
            }
            conn.execute(
                """
                UPDATE send_jobs
                SET status = ?,
                    lock_owner = NULL,
                    confirmation_result = ?,
                    updated_at = ?
                WHERE send_job_id = ?
                """,
                (
                    next_status,
                    _json_dumps(confirmation_result),
                    utc_timestamp(),
                    send_job_id,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))

    def mark_send_job(
        self,
        send_job_id: str,
        *,
        status: str,
        lock_owner: str | None = None,
        before_screenshot: str | None = None,
        after_screenshot: str | None = None,
        confirmation_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if confirmation_result is not None:
            confirmation = confirmation_result.get("confirmation")
            if isinstance(confirmation, dict):
                before_screenshot = before_screenshot or _optional_text(confirmation.get("before_screenshot"))
                after_screenshot = after_screenshot or _optional_text(confirmation.get("after_screenshot"))
        with self._connect() as conn:
            current = self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))
            if not current:
                raise KeyError(f"send job not found: {send_job_id}")
            conn.execute(
                """
                UPDATE send_jobs
                SET status = ?,
                    lock_owner = ?,
                    before_screenshot = COALESCE(?, before_screenshot),
                    after_screenshot = COALESCE(?, after_screenshot),
                    confirmation_result = COALESCE(?, confirmation_result),
                    updated_at = ?
                WHERE send_job_id = ?
                """,
                (
                    str(status).strip(),
                    lock_owner,
                    before_screenshot,
                    after_screenshot,
                    _json_dumps(confirmation_result) if confirmation_result is not None else None,
                    utc_timestamp(),
                    send_job_id,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))

    def create_send_attempt(self, send_job_id: str, *, status: str = "SENDING") -> dict[str, Any]:
        now = utc_timestamp()
        with self._connect() as conn:
            row = self._fetch_one(
                conn,
                "SELECT COALESCE(MAX(attempt_no), 0) AS max_attempt FROM send_attempts WHERE send_job_id = ?",
                (send_job_id,),
            )
            attempt_no = int(row.get("max_attempt") or 0) + 1
            attempt_id = f"attempt_{uuid4().hex}"
            conn.execute(
                """
                INSERT INTO send_attempts (
                    attempt_id, send_job_id, attempt_no, status, error_code,
                    error_message, before_screenshot, after_screenshot, started_at, finished_at
                ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, NULL)
                """,
                (attempt_id, send_job_id, attempt_no, status, now),
            )
            return self._fetch_one(conn, "SELECT * FROM send_attempts WHERE attempt_id = ?", (attempt_id,))

    def finish_send_attempt(
        self,
        attempt_id: str,
        *,
        status: str,
        error_code: str | None = None,
        error_message: str | None = None,
        before_screenshot: str | None = None,
        after_screenshot: str | None = None,
    ) -> dict[str, Any]:
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE send_attempts
                SET status = ?, error_code = ?, error_message = ?,
                    before_screenshot = COALESCE(?, before_screenshot),
                    after_screenshot = COALESCE(?, after_screenshot),
                    finished_at = ?
                WHERE attempt_id = ?
                """,
                (
                    status,
                    error_code,
                    error_message,
                    before_screenshot,
                    after_screenshot,
                    utc_timestamp(),
                    attempt_id,
                ),
            )
            return self._fetch_one(conn, "SELECT * FROM send_attempts WHERE attempt_id = ?", (attempt_id,))

    def recover_incomplete_jobs(self) -> None:
        with self._connect() as conn:
            conn.execute(
                f"""
                UPDATE send_jobs
                SET status = 'SEND_UNCERTAIN', lock_owner = NULL, updated_at = ?
                WHERE status IN ({','.join('?' for _ in INCOMPLETE_SEND_STATUSES)})
                """,
                (utc_timestamp(), *sorted(INCOMPLETE_SEND_STATUSES)),
            )

    def get_send_job(self, send_job_id: str) -> dict[str, Any]:
        with self._connect() as conn:
            row = self._fetch_one(conn, "SELECT * FROM send_jobs WHERE send_job_id = ?", (send_job_id,))
        if not row:
            raise KeyError(f"send job not found: {send_job_id}")
        return row

    def list_message_events(self, *, limit: int = 100) -> list[dict[str, Any]]:
        return self._fetch_all_public("SELECT * FROM message_events ORDER BY created_at DESC LIMIT ?", (limit,))

    def list_reply_jobs(self, *, status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if status:
            return self._fetch_all_public("SELECT * FROM reply_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status, limit))
        return self._fetch_all_public("SELECT * FROM reply_jobs ORDER BY created_at DESC LIMIT ?", (limit,))

    def list_send_jobs(self, *, status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if status:
            return self._fetch_all_public("SELECT * FROM send_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?", (status, limit))
        return self._fetch_all_public("SELECT * FROM send_jobs ORDER BY created_at DESC LIMIT ?", (limit,))

    def list_uncertain_send_jobs(self, *, limit: int = 100) -> list[dict[str, Any]]:
        return self.list_send_jobs(status="SEND_UNCERTAIN", limit=limit)

    def list_unresolved_uncertain_by_conversation(
        self,
        conversation_id: str,
        *,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        normalized_id = str(conversation_id).strip()
        return self._fetch_all_public(
            """
            SELECT * FROM send_jobs
            WHERE conversation_id = ? AND status = 'SEND_UNCERTAIN'
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (normalized_id, limit),
        )

    def conversation_has_unresolved_uncertain_send(self, conversation_id: str) -> bool:
        normalized_id = str(conversation_id).strip()
        if not normalized_id:
            return False
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT 1 FROM send_jobs
                WHERE conversation_id = ? AND status = 'SEND_UNCERTAIN'
                LIMIT 1
                """,
                (normalized_id,),
            ).fetchone()
        return row is not None

    def list_send_attempts(self, send_job_id: str, *, limit: int = 100) -> list[dict[str, Any]]:
        return self._fetch_all_public(
            """
            SELECT
                send_attempts.attempt_id,
                send_attempts.send_job_id,
                send_attempts.attempt_no,
                send_attempts.status,
                send_attempts.error_code,
                send_attempts.error_message,
                COALESCE(send_attempts.before_screenshot, send_jobs.before_screenshot) AS before_screenshot,
                COALESCE(send_attempts.after_screenshot, send_jobs.after_screenshot) AS after_screenshot,
                send_attempts.started_at,
                send_attempts.finished_at
            FROM send_attempts
            LEFT JOIN send_jobs ON send_jobs.send_job_id = send_attempts.send_job_id
            WHERE send_attempts.send_job_id = ?
            ORDER BY send_attempts.attempt_no ASC
            LIMIT ?
            """,
            (send_job_id, limit),
        )

    @staticmethod
    def message_signature(*, conversation_id: str, sender_name: str, content: str, source: str) -> str:
        payload = "|".join(
            [
                _normalize(conversation_id),
                _normalize(sender_name),
                _normalize(content),
                _normalize(source),
            ]
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def reply_idempotency_key(conversation_id: str, trigger_event_ids: Iterable[str]) -> str:
        payload = f"{_normalize(conversation_id)}|{','.join(sorted(str(value) for value in trigger_event_ids))}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def send_idempotency_key(reply_job_id: str, content: str) -> str:
        payload = f"{_normalize(reply_job_id)}|{_normalize(content)}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def _migrate(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS message_events (
                    event_id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    conversation_title TEXT NOT NULL DEFAULT '',
                    sender_name TEXT NOT NULL DEFAULT '',
                    sender_role TEXT NOT NULL DEFAULT 'user',
                    content TEXT NOT NULL,
                    message_type TEXT NOT NULL DEFAULT 'text',
                    source TEXT NOT NULL DEFAULT 'unknown',
                    signature TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 1.0,
                    screenshot_path TEXT,
                    ocr_raw TEXT,
                    created_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_message_events_signature
                ON message_events(signature);

                CREATE TABLE IF NOT EXISTS reply_jobs (
                    reply_job_id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    trigger_event_ids TEXT NOT NULL,
                    input_text TEXT NOT NULL,
                    context_snapshot_id TEXT,
                    status TEXT NOT NULL,
                    draft_reply TEXT,
                    risk_level TEXT NOT NULL DEFAULT 'LOW',
                    need_human_review INTEGER NOT NULL DEFAULT 0,
                    idempotency_key TEXT NOT NULL,
                    review_reason TEXT,
                    reviewed_by TEXT,
                    reviewed_at TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_reply_jobs_idempotency
                ON reply_jobs(idempotency_key);

                CREATE TABLE IF NOT EXISTS send_jobs (
                    send_job_id TEXT PRIMARY KEY,
                    reply_job_id TEXT NOT NULL,
                    conversation_id TEXT NOT NULL,
                    target_title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    status TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    lock_owner TEXT,
                    before_screenshot TEXT,
                    after_screenshot TEXT,
                    confirmation_result TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_send_jobs_idempotency
                ON send_jobs(idempotency_key);

                CREATE TABLE IF NOT EXISTS send_attempts (
                    attempt_id TEXT PRIMARY KEY,
                    send_job_id TEXT NOT NULL,
                    attempt_no INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    error_code TEXT,
                    error_message TEXT,
                    before_screenshot TEXT,
                    after_screenshot TEXT,
                    started_at TEXT NOT NULL,
                    finished_at TEXT
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_send_attempts_job_no
                ON send_attempts(send_job_id, attempt_no);
                """
            )
            self._ensure_columns(
                conn,
                "reply_jobs",
                {
                    "review_reason": "TEXT",
                    "reviewed_by": "TEXT",
                    "reviewed_at": "TEXT",
                },
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=TRUNCATE")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    def _ensure_columns(self, conn: sqlite3.Connection, table_name: str, columns: dict[str, str]) -> None:
        existing = {str(row["name"]) for row in conn.execute(f"PRAGMA table_info({table_name})").fetchall()}
        for column_name, column_type in columns.items():
            if column_name not in existing:
                conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

    def _fetch_all_public(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        with self._connect() as conn:
            return [self._public_row(row) for row in conn.execute(sql, params).fetchall()]

    def _fetch_one(self, conn: sqlite3.Connection, sql: str, params: tuple[Any, ...]) -> dict[str, Any]:
        row = conn.execute(sql, params).fetchone()
        return self._public_row(row) if row is not None else {}

    def _public_row(self, row: sqlite3.Row | None) -> dict[str, Any]:
        if row is None:
            return {}
        payload = dict(row)
        for key in ("trigger_event_ids", "ocr_raw", "confirmation_result"):
            if key in payload and isinstance(payload[key], str) and payload[key]:
                try:
                    payload[key] = json.loads(payload[key])
                except json.JSONDecodeError:
                    pass
        if "need_human_review" in payload:
            payload["need_human_review"] = bool(payload["need_human_review"])
        return payload


def _normalize(value: object) -> str:
    return " ".join(str(value or "").strip().split()).lower()


def _json_dumps(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _optional_text(value: object) -> str | None:
    text = str(value or "").strip()
    return text or None
