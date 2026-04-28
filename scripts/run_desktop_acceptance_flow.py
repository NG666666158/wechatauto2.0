from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Callable, Sequence


ROOT = Path(__file__).resolve().parents[1]
STABILITY_ACCEPTANCE = ROOT / "scripts" / "run_stability_acceptance.py"
RUNTIME_WEB_SMOKE = ROOT / "scripts" / "runtime_web_smoke_1min.ps1"

Runner = Callable[..., subprocess.CompletedProcess[str]]


def _configure_utf8_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def _summarize_text(value: str, *, limit: int = 2000) -> str:
    if len(value) <= limit:
        return value
    return value[:limit] + f"\n... truncated {len(value) - limit} chars"


def _parse_accepted(stdout: str, exit_code: int) -> bool:
    if exit_code != 0:
        return False
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return True
    if isinstance(payload, dict) and "accepted" in payload:
        return bool(payload["accepted"])
    return True


def _run_step(
    *,
    step_id: str,
    command: Sequence[str],
    runner: Runner,
    timeout_seconds: float | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    try:
        completed = runner(
            list(command),
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
        exit_code = int(completed.returncode)
        stdout = completed.stdout or ""
        stderr = completed.stderr or ""
    except subprocess.TimeoutExpired as exc:
        stdout_value = exc.stdout or ""
        stderr_value = exc.stderr or ""
        stdout = stdout_value.decode("utf-8", errors="replace") if isinstance(stdout_value, bytes) else str(stdout_value)
        stderr = stderr_value.decode("utf-8", errors="replace") if isinstance(stderr_value, bytes) else str(stderr_value)
        result = {
            "id": step_id,
            "command": list(command),
            "exit_code": None,
            "accepted": False,
            "skipped": False,
            "error": f"TimeoutExpired: {exc.timeout}",
            "stdout_summary": _summarize_text(stdout),
            "stderr_summary": _summarize_text(stderr),
        }
        if extra:
            result.update(extra)
        return result

    result = {
        "id": step_id,
        "command": list(command),
        "exit_code": exit_code,
        "accepted": _parse_accepted(stdout, exit_code),
        "skipped": False,
        "error": "",
        "stdout_summary": _summarize_text(stdout),
        "stderr_summary": _summarize_text(stderr),
    }
    if extra:
        result.update(extra)
    return result


def _skipped_step(step_id: str, command: Sequence[str], reason: str, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    result = {
        "id": step_id,
        "command": list(command),
        "exit_code": None,
        "accepted": None,
        "skipped": True,
        "skip_reason": reason,
        "stdout_summary": "",
        "stderr_summary": "",
    }
    if extra:
        result.update(extra)
    return result


def _stability_command(*, base_url: str, timeout_seconds: float, skip_http: bool) -> list[str]:
    command = [
        sys.executable,
        str(STABILITY_ACCEPTANCE),
        "--base-url",
        base_url,
        "--timeout-seconds",
        str(timeout_seconds),
        "--format",
        "json",
    ]
    if skip_http:
        command.append("--skip-http")
    return command


def _runtime_smoke_command(
    *,
    base_url: str,
    duration_seconds: int,
    ready_timeout_seconds: int,
    narrator_settle_seconds: int,
) -> list[str]:
    return [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        str(RUNTIME_WEB_SMOKE),
        "-BaseUrl",
        base_url,
        "-DurationSeconds",
        str(duration_seconds),
        "-ReadyTimeoutSeconds",
        str(ready_timeout_seconds),
        "-NarratorSettleSeconds",
        str(narrator_settle_seconds),
    ]


def build_desktop_acceptance_flow_report(
    *,
    base_url: str = "http://127.0.0.1:8765/api/v1",
    skip_http: bool = False,
    run_runtime_smoke: bool = False,
    timeout_seconds: float = 5.0,
    runtime_duration_seconds: int = 65,
    runtime_ready_timeout_seconds: int = 120,
    runtime_narrator_settle_seconds: int = 10,
    runner: Runner = subprocess.run,
) -> dict[str, Any]:
    source_command = _stability_command(base_url=base_url, timeout_seconds=timeout_seconds, skip_http=True)
    source_step = _run_step(
        step_id="stability_source",
        command=source_command,
        runner=runner,
        timeout_seconds=timeout_seconds + 10,
    )

    http_command = _stability_command(base_url=base_url, timeout_seconds=timeout_seconds, skip_http=False)
    if skip_http:
        http_step = _skipped_step("stability_http", http_command, "skip_http_requested")
    else:
        http_step = _run_step(
            step_id="stability_http",
            command=http_command,
            runner=runner,
            timeout_seconds=timeout_seconds * 6 + 10,
        )

    smoke_command = _runtime_smoke_command(
        base_url=base_url,
        duration_seconds=runtime_duration_seconds,
        ready_timeout_seconds=runtime_ready_timeout_seconds,
        narrator_settle_seconds=runtime_narrator_settle_seconds,
    )
    smoke_extra = {
        "manual_message_injection_required": True,
        "does_not_send_messages": True,
    }
    if run_runtime_smoke:
        smoke_step = _run_step(
            step_id="runtime_smoke",
            command=smoke_command,
            runner=runner,
            timeout_seconds=runtime_duration_seconds + runtime_ready_timeout_seconds + 120,
            extra=smoke_extra,
        )
    else:
        smoke_step = _skipped_step(
            "runtime_smoke",
            smoke_command,
            "runtime_smoke_requires_explicit_enable",
            extra=smoke_extra,
        )

    steps = {
        "stability_source": source_step,
        "stability_http": http_step,
        "runtime_smoke": smoke_step,
    }
    failures = [
        step_id
        for step_id, step in steps.items()
        if not step["skipped"] and not step["accepted"]
    ]
    return {
        "script": "desktop_acceptance_flow",
        "safe_read_only": not run_runtime_smoke,
        "does_not_send_messages": True,
        "runtime_smoke_enabled": run_runtime_smoke,
        "accepted": not failures,
        "base_url": base_url,
        "steps": steps,
        "failures": failures,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the unified WeChatAuto desktop acceptance flow.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8765/api/v1")
    parser.add_argument("--skip-http", action="store_true", help="Skip backend HTTP acceptance checks.")
    runtime_group = parser.add_mutually_exclusive_group()
    runtime_group.add_argument(
        "--run-runtime-smoke",
        action="store_true",
        help="Explicitly run runtime_web_smoke_1min.ps1. This starts/stops runtime but does not send messages.",
    )
    runtime_group.add_argument(
        "--skip-runtime-smoke",
        action="store_true",
        help="Keep runtime smoke disabled. This is the default safe path.",
    )
    parser.add_argument("--timeout-seconds", type=float, default=5.0)
    parser.add_argument("--runtime-duration-seconds", type=int, default=65)
    parser.add_argument("--runtime-ready-timeout-seconds", type=int, default=120)
    parser.add_argument("--runtime-narrator-settle-seconds", type=int, default=10)
    parser.add_argument("--format", choices=("json", "pretty"), default="json")
    return parser


def main() -> int:
    _configure_utf8_stdio()
    args = build_parser().parse_args()
    report = build_desktop_acceptance_flow_report(
        base_url=str(args.base_url),
        skip_http=bool(args.skip_http),
        run_runtime_smoke=bool(args.run_runtime_smoke),
        timeout_seconds=float(args.timeout_seconds),
        runtime_duration_seconds=int(args.runtime_duration_seconds),
        runtime_ready_timeout_seconds=int(args.runtime_ready_timeout_seconds),
        runtime_narrator_settle_seconds=int(args.runtime_narrator_settle_seconds),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2 if args.format == "pretty" else None))
    return 0 if report["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
