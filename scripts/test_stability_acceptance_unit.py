from __future__ import annotations

import json
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class StabilityAcceptanceTests(unittest.TestCase):
    def test_stability_acceptance_source_checks_are_present(self) -> None:
        from scripts.run_stability_acceptance import build_stability_acceptance_report

        report = build_stability_acceptance_report(skip_http=True)

        self.assertEqual(report["script"], "stability_acceptance")
        self.assertTrue(report["safe_read_only"])
        self.assertTrue(report["does_not_send_messages"])
        self.assertTrue(report["accepted"])
        self.assertTrue(report["checks"]["source_contracts"]["rag_trust_diagnostics"]["tokens_present"])
        self.assertTrue(report["checks"]["source_contracts"]["rag_trusted_rebuild"]["tokens_present"])
        self.assertEqual(report["failures"], [])

    def test_stability_acceptance_http_probe_checks_required_fields(self) -> None:
        from scripts.run_stability_acceptance import build_stability_acceptance_report

        server = ThreadingHTTPServer(("127.0.0.1", 0), _StabilityApiHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            report = build_stability_acceptance_report(
                base_url=f"http://127.0.0.1:{server.server_port}/api/v1",
                skip_http=False,
                timeout_seconds=2.0,
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertTrue(report["accepted"])
        self.assertTrue(report["checks"]["http_contracts"]["dashboard_summary"]["required_fields_present"])
        self.assertTrue(report["checks"]["http_contracts"]["send_uncertain_metrics"]["required_fields_present"])
        self.assertTrue(report["checks"]["http_contracts"]["knowledge_acceptance"]["required_fields_present"])
        self.assertTrue(report["checks"]["http_contracts"]["knowledge_trust_diagnostics"]["required_fields_present"])
        self.assertTrue(report["checks"]["http_contracts"]["knowledge_trusted_rebuild"]["required_fields_present"])

    def test_stability_acceptance_cli_outputs_json(self) -> None:
        result = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "run_stability_acceptance.py"),
                "--skip-http",
                "--format",
                "json",
            ],
            capture_output=True,
            text=True,
            check=True,
        )

        payload = json.loads(result.stdout)
        self.assertEqual(payload["script"], "stability_acceptance")
        self.assertTrue(payload["accepted"])


class _StabilityApiHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        self._send_payload(self._payload_for_path(self.path))

    def do_POST(self) -> None:  # noqa: N802
        self._send_payload(self._payload_for_path(self.path))

    def _send_payload(self, payload: dict[str, object]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _payload_for_path(self, path: str) -> dict[str, object]:
        if path.startswith("/api/v1/dashboard/summary"):
            return {"success": True, "data": {"send_uncertain": {"unresolved_total": 1}}}
        if path.startswith("/api/v1/jobs/send-uncertain/metrics"):
            return {
                "success": True,
                "data": {
                    "unresolved_total": 1,
                    "recent_24h": 1,
                    "top_error_codes": [],
                    "top_conversations": [],
                },
            }
        if path.startswith("/api/v1/settings/safety-policy/audit"):
            return {"success": True, "data": []}
        if path.startswith("/api/v1/debug/knowledge-acceptance"):
            return {
                "success": True,
                "data": {
                    "retrieved_chunk_ids": [],
                    "knowledge_status": {"ready": False},
                },
            }
        if path.startswith("/api/v1/knowledge/trust-diagnostics"):
            return {
                "success": True,
                "data": {
                    "trust_status": "fake",
                    "blocked_for_real_send": True,
                    "trusted_rebuild_available": True,
                    "recommended_actions": ["rebuild_with_trusted_embeddings"],
                },
            }
        if path.startswith("/api/v1/knowledge/trusted-rebuild"):
            return {
                "success": True,
                "data": {
                    "accepted": True,
                    "status": "rebuilt",
                    "trust_diagnostics": {"trust_status": "trusted"},
                },
            }
        return {"success": False, "error": {"code": "NOT_FOUND", "message": path}}

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        return


if __name__ == "__main__":
    unittest.main()
