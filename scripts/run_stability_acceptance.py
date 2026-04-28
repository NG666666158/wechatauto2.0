from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


REQUIRED_SOURCE_TOKENS = {
    "runtime_preflight": (
        ROOT / "wechat_ai" / "runtime" / "send_preflight.py",
        (
            "evaluate_conversation_send_preflight",
            "evaluate_send_coordinator_precheck",
            "UNRESOLVED_SEND_UNCERTAIN",
        ),
    ),
    "send_uncertain_metrics": (
        ROOT / "wechat_ai" / "storage" / "runtime_state.py",
        (
            "get_send_uncertain_metrics",
            "top_error_codes",
            "top_conversations",
        ),
    ),
    "safety_policy_audit": (
        ROOT / "wechat_ai" / "app" / "safety_audit.py",
        (
            "SafetyPolicyAuditTrail",
            "changed_rule_groups",
            "reset_to_defaults",
        ),
    ),
    "rag_manual_review": (
        ROOT / "wechat_ai" / "app" / "service.py",
        (
            "_requires_untrusted_knowledge_review",
            "_create_untrusted_knowledge_reply_job",
            "UNTRUSTED_KNOWLEDGE_CONTEXT",
        ),
    ),
    "rag_trust_diagnostics": (
        ROOT / "wechat_ai" / "app" / "service.py",
        (
            "get_knowledge_trust_diagnostics",
            "blocked_for_real_send",
            "recommended_actions",
        ),
    ),
    "rag_trusted_rebuild": (
        ROOT / "wechat_ai" / "app" / "service.py",
        (
            "rebuild_knowledge_with_trusted_embeddings",
            "TRUSTED_EMBEDDING_PROVIDER_UNAVAILABLE",
            "trusted_rebuild_available",
        ),
    ),
    "home_risk_overview": (
        ROOT / "desktop_app" / "frontend" / "app" / "page.tsx",
        (
            "SendUncertainRiskOverview",
            "SEND_UNCERTAIN risk overview",
            "getSendUncertainMetrics",
        ),
    ),
}


HTTP_CHECKS = (
    ("dashboard_summary", "GET", "/dashboard/summary", ("send_uncertain",)),
    ("send_uncertain_metrics", "GET", "/jobs/send-uncertain/metrics", ("unresolved_total", "recent_24h")),
    ("safety_policy_audit", "GET", "/settings/safety-policy/audit?limit=5", ()),
    ("knowledge_trust_diagnostics", "GET", "/knowledge/trust-diagnostics", ("trust_status", "blocked_for_real_send", "trusted_rebuild_available", "recommended_actions")),
    ("knowledge_trusted_rebuild", "POST", "/knowledge/trusted-rebuild", ("accepted", "status", "trust_diagnostics")),
    ("knowledge_acceptance", "GET", "/debug/knowledge-acceptance?q=试用政策", ("retrieved_chunk_ids", "knowledge_status")),
)


def _configure_utf8_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def inspect_source_contracts() -> dict[str, Any]:
    checks: dict[str, Any] = {}
    for check_id, (path, tokens) in REQUIRED_SOURCE_TOKENS.items():
        if not path.exists():
            checks[check_id] = {
                "file": str(path),
                "exists": False,
                "tokens_present": False,
                "missing_tokens": list(tokens),
            }
            continue
        source = path.read_text(encoding="utf-8", errors="replace")
        missing = [token for token in tokens if token not in source]
        checks[check_id] = {
            "file": str(path),
            "exists": True,
            "tokens_present": not missing,
            "missing_tokens": missing,
        }
    return checks


def _http_json(base_url: str, method: str, path: str, *, timeout_seconds: float) -> dict[str, Any]:
    encoded_path = quote(path.lstrip("/"), safe="/?=&:%")
    url = f"{base_url.rstrip('/')}/{encoded_path}"
    body = None
    headers: dict[str, str] = {}
    if method.upper() in {"POST", "PATCH", "PUT"}:
        body = b"{}"
        headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8", errors="replace")
            status_code = getattr(response, "status", 200)
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {
            "url": url,
            "reachable": False,
            "status_code": exc.code,
            "success": False,
            "error": f"HTTPError: {exc.code}",
            "body_preview": body[:500],
        }
    except URLError as exc:
        return {
            "url": url,
            "reachable": False,
            "status_code": None,
            "success": False,
            "error": f"URLError: {exc.reason}",
            "body_preview": "",
        }
    try:
        payload = json.loads(body)
    except json.JSONDecodeError as exc:
        return {
            "url": url,
            "reachable": True,
            "status_code": status_code,
            "success": False,
            "error": f"JSONDecodeError: {exc}",
            "body_preview": body[:500],
        }
    return {
        "url": url,
        "reachable": True,
        "status_code": status_code,
        "success": bool(payload.get("success", False)),
        "payload": payload,
        "error": "",
    }


def probe_http_contracts(base_url: str, *, skip_http: bool, timeout_seconds: float) -> dict[str, Any]:
    if skip_http:
        return {
            check_id: {
                "url": f"{base_url.rstrip('/')}/{path.lstrip('/')}",
                "skipped": True,
                "success": None,
                "required_fields_present": None,
                "missing_fields": [],
            }
            for check_id, _, path, _ in HTTP_CHECKS
        }
    checks: dict[str, Any] = {}
    for check_id, method, path, required_fields in HTTP_CHECKS:
        result = _http_json(base_url, method, path, timeout_seconds=timeout_seconds)
        data = result.get("payload", {}).get("data") if isinstance(result.get("payload"), dict) else None
        missing = [field for field in required_fields if not _has_field(data, field)]
        result["skipped"] = False
        result["required_fields_present"] = not missing
        result["missing_fields"] = missing
        checks[check_id] = result
    return checks


def _has_field(value: Any, field: str) -> bool:
    if isinstance(value, dict):
        return field in value
    if isinstance(value, list):
        return not value or all(isinstance(item, dict) and field in item for item in value)
    return False


def build_stability_acceptance_report(
    *,
    base_url: str = "http://127.0.0.1:8765/api/v1",
    skip_http: bool = True,
    timeout_seconds: float = 5.0,
) -> dict[str, Any]:
    source_checks = inspect_source_contracts()
    http_checks = probe_http_contracts(base_url, skip_http=skip_http, timeout_seconds=timeout_seconds)
    failures: list[str] = []
    for check_id, result in source_checks.items():
        if not result["exists"]:
            failures.append(f"{check_id}:source_missing")
        elif not result["tokens_present"]:
            failures.append(f"{check_id}:source_tokens_missing")
    if not skip_http:
        for check_id, result in http_checks.items():
            if not result.get("reachable"):
                failures.append(f"{check_id}:unreachable")
            elif not result.get("success"):
                failures.append(f"{check_id}:api_unsuccessful")
            elif not result.get("required_fields_present"):
                failures.append(f"{check_id}:required_fields_missing")
    return {
        "script": "stability_acceptance",
        "safe_read_only": True,
        "does_not_send_messages": True,
        "accepted": not failures,
        "base_url": base_url,
        "checks": {
            "source_contracts": source_checks,
            "http_contracts": http_checks,
        },
        "failures": failures,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run WeChatAuto stability acceptance checks.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765/api/v1")
    parser.add_argument("--skip-http", action="store_true", help="Only run local source checks.")
    parser.add_argument("--timeout-seconds", type=float, default=5.0)
    parser.add_argument("--format", choices=("json", "pretty"), default="json")
    return parser


def main() -> int:
    _configure_utf8_stdio()
    args = build_parser().parse_args()
    report = build_stability_acceptance_report(
        base_url=str(args.base_url),
        skip_http=bool(args.skip_http),
        timeout_seconds=float(args.timeout_seconds),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2 if args.format == "pretty" else None))
    return 0 if report["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
