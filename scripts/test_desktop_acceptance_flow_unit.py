from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class DesktopAcceptanceFlowTests(unittest.TestCase):
    def test_source_only_flow_runs_stability_source_check_and_skips_optional_steps(self) -> None:
        from scripts.run_desktop_acceptance_flow import build_desktop_acceptance_flow_report

        executed_commands: list[list[str]] = []

        def fake_runner(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            executed_commands.append(command)
            return subprocess.CompletedProcess(
                command,
                0,
                stdout=json.dumps({"accepted": True, "script": "stability_acceptance"}),
                stderr="",
            )

        report = build_desktop_acceptance_flow_report(
            skip_http=True,
            run_runtime_smoke=False,
            runner=fake_runner,
        )

        self.assertTrue(report["safe_read_only"])
        self.assertTrue(report["does_not_send_messages"])
        self.assertTrue(report["accepted"])
        self.assertEqual(len(executed_commands), 1)
        self.assertIn("run_stability_acceptance.py", executed_commands[0][1])
        self.assertIn("--skip-http", executed_commands[0])
        self.assertTrue(report["steps"]["stability_source"]["accepted"])
        self.assertTrue(report["steps"]["stability_http"]["skipped"])
        self.assertTrue(report["steps"]["runtime_smoke"]["skipped"])

    def test_http_flow_runs_source_then_http_without_runtime_smoke_by_default(self) -> None:
        from scripts.run_desktop_acceptance_flow import build_desktop_acceptance_flow_report

        executed_commands: list[list[str]] = []

        def fake_runner(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            executed_commands.append(command)
            return subprocess.CompletedProcess(
                command,
                0,
                stdout=json.dumps({"accepted": True}),
                stderr="",
            )

        report = build_desktop_acceptance_flow_report(
            skip_http=False,
            run_runtime_smoke=False,
            runner=fake_runner,
        )

        self.assertTrue(report["accepted"])
        self.assertEqual(len(executed_commands), 2)
        self.assertIn("--skip-http", executed_commands[0])
        self.assertNotIn("--skip-http", executed_commands[1])
        self.assertTrue(report["steps"]["runtime_smoke"]["skipped"])

    def test_runtime_smoke_only_runs_when_explicitly_enabled(self) -> None:
        from scripts.run_desktop_acceptance_flow import build_desktop_acceptance_flow_report

        executed_commands: list[list[str]] = []

        def fake_runner(command: list[str], **kwargs: object) -> subprocess.CompletedProcess[str]:
            executed_commands.append(command)
            stdout = json.dumps({"accepted": True}) if "run_stability_acceptance.py" in command[1] else "smoke ok"
            return subprocess.CompletedProcess(command, 0, stdout=stdout, stderr="")

        report = build_desktop_acceptance_flow_report(
            skip_http=True,
            run_runtime_smoke=True,
            runner=fake_runner,
        )

        self.assertFalse(report["safe_read_only"])
        self.assertTrue(report["does_not_send_messages"])
        self.assertTrue(report["accepted"])
        self.assertEqual(len(executed_commands), 2)
        self.assertIn("runtime_web_smoke_1min.ps1", " ".join(executed_commands[1]))
        self.assertIn("manual_message_injection_required", report["steps"]["runtime_smoke"])

    def test_cli_outputs_json_report_for_default_safe_path(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "run_desktop_acceptance_flow.py"),
                "--skip-http",
                "--skip-runtime-smoke",
                "--format",
                "json",
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        payload = json.loads(result.stdout)
        self.assertEqual(payload["script"], "desktop_acceptance_flow")
        self.assertTrue(payload["safe_read_only"])
        self.assertTrue(payload["does_not_send_messages"])
        self.assertTrue(payload["steps"]["runtime_smoke"]["skipped"])


if __name__ == "__main__":
    unittest.main()
