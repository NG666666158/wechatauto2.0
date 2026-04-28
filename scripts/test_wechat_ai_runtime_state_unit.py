from __future__ import annotations

import shutil
import sys
import uuid
from pathlib import Path
from unittest import TestCase, main


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP_ROOT = ROOT / ".tmp"
TMP_ROOT.mkdir(exist_ok=True)


def _fresh_dir(prefix: str) -> Path:
    path = TMP_ROOT / prefix.lstrip(".") / uuid.uuid4().hex
    path.mkdir(parents=True, exist_ok=True)
    return path


class RuntimeStateStoreTests(TestCase):
    def test_message_reply_and_send_jobs_are_idempotent(self) -> None:
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_runtime_state_idempotent")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")

            event = store.record_message_event(
                conversation_id="friend:Alice",
                conversation_title="Alice",
                sender_name="Alice",
                content="hello",
                source="unread",
            )
            same_event = store.record_message_event(
                conversation_id="friend:Alice",
                conversation_title="Alice",
                sender_name="Alice",
                content="hello",
                source="unread",
            )
            reply = store.create_reply_job(
                conversation_id="friend:Alice",
                trigger_event_ids=[event["event_id"]],
                input_text="hello",
                draft_reply="hi",
                status="APPROVED",
            )
            same_reply = store.create_reply_job(
                conversation_id="friend:Alice",
                trigger_event_ids=[same_event["event_id"]],
                input_text="hello",
                draft_reply="hi",
                status="APPROVED",
            )
            send = store.create_send_job(
                reply_job_id=reply["reply_job_id"],
                conversation_id="friend:Alice",
                target_title="Alice",
                content="hi",
            )
            same_send = store.create_send_job(
                reply_job_id=same_reply["reply_job_id"],
                conversation_id="friend:Alice",
                target_title="Alice",
                content="hi",
            )

            self.assertEqual(event["event_id"], same_event["event_id"])
            self.assertEqual(reply["reply_job_id"], same_reply["reply_job_id"])
            self.assertEqual(send["send_job_id"], same_send["send_job_id"])
            self.assertEqual(len(store.list_message_events()), 1)
            self.assertEqual(len(store.list_reply_jobs()), 1)
            self.assertEqual(len(store.list_send_jobs()), 1)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_recover_incomplete_send_jobs_marks_uncertain_and_clears_lock(self) -> None:
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_runtime_state_recover")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")
            reply = store.create_reply_job(
                conversation_id="friend:Alice",
                trigger_event_ids=["event-1"],
                input_text="hello",
                draft_reply="hi",
                status="APPROVED",
            )
            send = store.create_send_job(
                reply_job_id=reply["reply_job_id"],
                conversation_id="friend:Alice",
                target_title="Alice",
                content="hi",
            )
            store.mark_send_job(send["send_job_id"], status="SENDING", lock_owner="worker-1")

            store.recover_incomplete_jobs()
            recovered = store.get_send_job(send["send_job_id"])

            self.assertEqual(recovered["status"], "SEND_UNCERTAIN")
            self.assertIsNone(recovered["lock_owner"])
            self.assertEqual(store.list_uncertain_send_jobs()[0]["send_job_id"], send["send_job_id"])
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class SendCoordinatorTests(TestCase):
    def test_confirmed_send_records_attempt_and_prevents_duplicate_resend(self) -> None:
        from wechat_ai.runtime.send_coordinator import SendCoordinator
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_send_coordinator_confirmed")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")
            sent: list[dict[str, object]] = []

            def sender(**kwargs):
                sent.append(kwargs)
                return {"sent": True}

            coordinator = SendCoordinator(
                store=store,
                sender=sender,
                confirmer=lambda **kwargs: True,
                precheck=lambda **kwargs: {"ok": True},
            )

            result = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )
            duplicate = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )

            self.assertEqual(result["status"], "sent_confirmed")
            self.assertEqual(duplicate["status"], "already_sent")
            self.assertEqual(len(sent), 1)
            self.assertEqual(store.list_send_attempts(result["send_job_id"])[0]["status"], "SENT_CONFIRMED")
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_unconfirmed_send_is_uncertain_and_not_retried(self) -> None:
        from wechat_ai.runtime.send_coordinator import SendCoordinator
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_send_coordinator_uncertain")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")
            sent: list[dict[str, object]] = []

            def sender(**kwargs):
                sent.append(kwargs)
                return {"sent": True}

            coordinator = SendCoordinator(
                store=store,
                sender=sender,
                confirmer=lambda **kwargs: False,
                precheck=lambda **kwargs: {"ok": True},
            )

            result = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )
            duplicate = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )

            self.assertEqual(result["status"], "send_uncertain")
            self.assertEqual(duplicate["status"], "send_uncertain")
            self.assertEqual(len(sent), 1)
            self.assertEqual(store.list_uncertain_send_jobs()[0]["send_job_id"], result["send_job_id"])
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_uncertain_send_invokes_callback_with_job_and_result_context(self) -> None:
        from wechat_ai.runtime.send_coordinator import SendCoordinator
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_send_coordinator_uncertain_callback")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")
            callbacks: list[dict[str, object]] = []

            coordinator = SendCoordinator(
                store=store,
                sender=lambda **kwargs: {"sent": True, "transport_id": "tx-1"},
                confirmer=lambda **kwargs: False,
                precheck=lambda **kwargs: {"ok": True},
                on_uncertain=lambda send_job, result: callbacks.append(
                    {"send_job": dict(send_job), "result": dict(result)}
                ),
            )

            result = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )

            self.assertEqual(result["status"], "send_uncertain")
            self.assertEqual(len(callbacks), 1)
            self.assertEqual(callbacks[0]["send_job"]["conversation_id"], "friend:Alice")
            self.assertEqual(callbacks[0]["send_job"]["send_job_id"], result["send_job_id"])
            self.assertEqual(callbacks[0]["result"]["status"], "send_uncertain")
            self.assertEqual(callbacks[0]["result"]["send_job_id"], result["send_job_id"])
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def test_precheck_failure_blocks_send_before_sender_runs(self) -> None:
        from wechat_ai.runtime.send_coordinator import SendCoordinator
        from wechat_ai.storage.runtime_state import RuntimeStateStore

        temp_dir = _fresh_dir(".tmp_send_coordinator_precheck")
        try:
            store = RuntimeStateStore(temp_dir / "runtime_state.sqlite3")
            sent: list[dict[str, object]] = []
            coordinator = SendCoordinator(
                store=store,
                sender=lambda **kwargs: sent.append(kwargs) or {"sent": True},
                confirmer=lambda **kwargs: True,
                precheck=lambda **kwargs: {"ok": False, "reason_code": "TARGET_CONVERSATION_NOT_CONFIRMED"},
            )

            result = coordinator.send_reply(
                conversation_id="friend:Alice",
                target_title="Alice",
                text="hi",
                reply_job_id="reply-1",
            )

            self.assertEqual(result["status"], "send_failed")
            self.assertEqual(result["reason_code"], "TARGET_CONVERSATION_NOT_CONFIRMED")
            self.assertEqual(sent, [])
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
