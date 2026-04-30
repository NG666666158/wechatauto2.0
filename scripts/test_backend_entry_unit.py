from __future__ import annotations

import os
import importlib
import sys
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class BackendEntryTests(unittest.TestCase):
    def test_paths_data_dir_can_be_redirected_by_environment(self) -> None:
        os.environ["WECHAT_AI_DATA_DIR"] = str(ROOT / ".tmp" / "packaged-data")
        sys.modules.pop("wechat_ai.paths", None)
        import wechat_ai  # type: ignore  # noqa: E402

        if hasattr(wechat_ai, "paths"):
            delattr(wechat_ai, "paths")

        paths = importlib.import_module("wechat_ai.paths")

        self.assertEqual(paths.DATA_DIR, ROOT / ".tmp" / "packaged-data")
        self.assertEqual(paths.APP_DIR, paths.DATA_DIR / "app")

    def test_bootstrap_probe_command_uses_module_in_source_mode(self) -> None:
        from wechat_ai.app.service import DesktopAppService  # type: ignore  # noqa: E402

        service = DesktopAppService.__new__(DesktopAppService)
        with mock.patch.object(sys, "executable", "python.exe"):
            command = service._bootstrap_probe_command("--ready-timeout", "1")

        self.assertEqual(command, ["python.exe", "-m", "wechat_ai.app.bootstrap_probe_runner", "--ready-timeout", "1"])

    def test_bootstrap_probe_command_uses_backend_exe_in_frozen_mode(self) -> None:
        from wechat_ai.app.service import DesktopAppService  # type: ignore  # noqa: E402

        service = DesktopAppService.__new__(DesktopAppService)
        with mock.patch.object(sys, "executable", "wechat-ai-backend.exe"), mock.patch.object(sys, "frozen", True, create=True):
            command = service._bootstrap_probe_command("--ready-timeout", "1")

        self.assertEqual(command, ["wechat-ai-backend.exe", "--bootstrap-wechat-probe", "--ready-timeout", "1"])

    def test_runtime_and_watchdog_commands_use_backend_exe_in_frozen_mode(self) -> None:
        from wechat_ai.app import service as service_module  # type: ignore  # noqa: E402

        runner = service_module._SubprocessDaemonRunner(project_root=ROOT)
        with mock.patch.object(sys, "executable", "wechat-ai-backend.exe"), mock.patch.object(sys, "frozen", True, create=True):
            runtime = runner._runtime_command("--forever")
            watchdog = runner._watchdog_command("--target-pid", "123")

        self.assertEqual(runtime, ["wechat-ai-backend.exe", "--run-auto-reply", "--forever"])
        self.assertEqual(watchdog, ["wechat-ai-backend.exe", "--emergency-stop-watchdog", "--target-pid", "123"])

    def test_backend_build_script_collects_document_parser_dependencies(self) -> None:
        build_script = (ROOT / "scripts" / "build_backend_exe.ps1").read_text(encoding="utf-8")

        self.assertIn('"--collect-all", "docx"', build_script)
        self.assertIn('"--collect-all", "pypdf"', build_script)
        self.assertIn('"--collect-all", "lxml"', build_script)


if __name__ == "__main__":
    unittest.main()
