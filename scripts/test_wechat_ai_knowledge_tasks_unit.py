from __future__ import annotations

import shutil
import sys
import uuid
from pathlib import Path
from unittest import TestCase


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
TMP_ROOT = ROOT / ".tmp"
TMP_ROOT.mkdir(exist_ok=True)


def _fresh_dir(prefix: str) -> Path:
    path = TMP_ROOT / prefix.lstrip(".") / uuid.uuid4().hex
    path.mkdir(parents=True, exist_ok=True)
    return path


class KnowledgeTaskStoreTests(TestCase):
    def test_append_task_persists_expected_fields(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_append")
        try:
            store = KnowledgeTaskStore(root / "knowledge_tasks.json")
            task = store.append_task(
                task_type="import",
                title="Import FAQ",
                status="running",
                summary="2 files queued",
                metadata={"source": "desktop"},
            )

            reloaded = KnowledgeTaskStore(root / "knowledge_tasks.json").recent_tasks()
            self.assertEqual(len(reloaded), 1)
            self.assertEqual(reloaded[0]["id"], task["id"])
            self.assertEqual(reloaded[0]["type"], "import")
            self.assertEqual(reloaded[0]["title"], "Import FAQ")
            self.assertEqual(reloaded[0]["status"], "running")
            self.assertEqual(reloaded[0]["stage"], "queued")
            self.assertEqual(reloaded[0]["summary"], "2 files queued")
            self.assertEqual(reloaded[0]["error"], "")
            self.assertEqual(reloaded[0]["metadata"], {"source": "desktop"})
            self.assertTrue(reloaded[0]["created_at"])
            self.assertEqual(reloaded[0]["created_at"], reloaded[0]["updated_at"])
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_update_task_status_keeps_created_at_and_merges_metadata(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_update")
        try:
            store = KnowledgeTaskStore(root / "knowledge_tasks.json")
            task = store.append_task(
                task_type="web_build",
                title="Build website knowledge",
                metadata={"url": "https://example.test"},
            )

            updated = store.update_task(
                task["id"],
                status="failed",
                stage="vectorize",
                summary="Downloaded 3 pages",
                error="timeout",
                metadata={"pages": 3},
            )

            self.assertIsNotNone(updated)
            self.assertEqual(updated["id"], task["id"])
            self.assertEqual(updated["created_at"], task["created_at"])
            self.assertNotEqual(updated["updated_at"], task["updated_at"])
            self.assertEqual(updated["status"], "failed")
            self.assertEqual(updated["stage"], "vectorize")
            self.assertEqual(updated["summary"], "Downloaded 3 pages")
            self.assertEqual(updated["error"], "timeout")
            self.assertEqual(updated["metadata"], {"url": "https://example.test", "pages": 3})
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_recent_tasks_returns_newest_updated_tasks_first_with_limit(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_recent")
        try:
            store = KnowledgeTaskStore(root / "knowledge_tasks.json")
            first = store.append_task(task_type="import", title="First")
            second = store.append_task(task_type="rebuild", title="Second")
            third = store.append_task(task_type="ai_normalize", title="Third")
            store.update_task(first["id"], status="completed")

            recent = store.recent_tasks(limit=2)

            self.assertEqual([task["id"] for task in recent], [first["id"], third["id"]])
            self.assertNotIn(second["id"], [task["id"] for task in recent])
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_update_task_stage_and_advance_task_merge_metadata(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_stage")
        try:
            store = KnowledgeTaskStore(root / "knowledge_tasks.json")
            task = store.append_task(task_type="import", title="Import handbook")

            updated = store.update_task(task["id"], stage="extract")
            advanced = store.advance_task(
                task["id"],
                "index",
                summary="Indexed 8 chunks",
                metadata={"chunks": 8},
            )

            self.assertIsNotNone(updated)
            self.assertEqual(updated["stage"], "extract")
            self.assertIsNotNone(advanced)
            self.assertEqual(advanced["stage"], "index")
            self.assertEqual(advanced["summary"], "Indexed 8 chunks")
            self.assertEqual(advanced["metadata"], {"chunks": 8})
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_legacy_tasks_without_stage_read_with_compatible_stage(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_legacy_stage")
        try:
            path = root / "knowledge_tasks.json"
            path.write_text(
                """
                {
                  "tasks": [
                    {
                      "id": "task_done",
                      "type": "import",
                      "title": "Done",
                      "status": "completed",
                      "created_at": "2026-04-29T01:00:00Z",
                      "updated_at": "2026-04-29T01:00:00Z"
                    },
                    {
                      "id": "task_old",
                      "type": "import",
                      "title": "Old",
                      "status": "pending",
                      "created_at": "2026-04-29T00:00:00Z",
                      "updated_at": "2026-04-29T00:00:00Z"
                    }
                  ]
                }
                """,
                encoding="utf-8",
            )

            tasks = KnowledgeTaskStore(path).recent_tasks(limit=2)

            self.assertEqual(tasks[0]["id"], "task_done")
            self.assertEqual(tasks[0]["stage"], "accept")
            self.assertEqual(tasks[1]["id"], "task_old")
            self.assertEqual(tasks[1]["stage"], "queued")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_missing_or_damaged_file_returns_empty_list_and_can_recover(self) -> None:
        from wechat_ai.app.knowledge_tasks import KnowledgeTaskStore

        root = _fresh_dir(".tmp_knowledge_tasks_damaged")
        try:
            path = root / "knowledge_tasks.json"
            store = KnowledgeTaskStore(path)
            self.assertEqual(store.recent_tasks(), [])

            path.write_text("{not valid json", encoding="utf-8")
            self.assertEqual(store.recent_tasks(), [])

            task = store.append_task(task_type="rebuild", title="Recover rebuild")
            self.assertEqual(store.recent_tasks()[0]["id"], task["id"])
        finally:
            shutil.rmtree(root, ignore_errors=True)
