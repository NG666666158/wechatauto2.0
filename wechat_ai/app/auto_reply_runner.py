from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

from wechat_ai import paths
from wechat_ai.wechat_runtime import EmergencyStopWatcher, WeChatAIApp, _build_force_stop_hotkey_monitor


def _configure_console_output() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="backslashreplace")


def main(argv: list[str] | None = None) -> int:
    _configure_console_output()
    parser = argparse.ArgumentParser(description="Run global WeChat AI auto reply.")
    parser.add_argument("--duration", default="5min")
    parser.add_argument("--poll-interval", type=float, default=1.0)
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--active-merge-window", type=float, default=3.0)
    parser.add_argument("--forever", action="store_true")
    parser.add_argument("--heartbeat-interval", type=float, default=60.0)
    parser.add_argument("--error-backoff-seconds", type=float, default=5.0)
    parser.add_argument("--force-stop-hotkey", default="ctrl+shift+f12")
    parser.add_argument("--force-stop-file", default=str(paths.DATA_DIR / "app" / "force_stop.flag"))
    args = parser.parse_args(argv)

    stop_file = Path(args.force_stop_file)
    stop_file.parent.mkdir(parents=True, exist_ok=True)
    try:
        stop_file.unlink()
    except FileNotFoundError:
        pass
    except OSError:
        stop_file.write_text("", encoding="utf-8")

    def emergency_exit(reason: str) -> None:
        print(f"[wechat_ai] emergency stop triggered reason={reason}", flush=True)
        os._exit(130)

    watcher = EmergencyStopWatcher(
        hotkey_monitor=_build_force_stop_hotkey_monitor(args.force_stop_hotkey),
        stop_file=stop_file,
        on_trigger=emergency_exit,
    ).start()

    app = WeChatAIApp.from_env()
    app.debug = args.debug
    app.active_merge_window = args.active_merge_window
    try:
        result = app.run_global_auto_reply(
            duration=args.duration,
            poll_interval=args.poll_interval,
            forever=args.forever,
            heartbeat_interval=args.heartbeat_interval,
            error_backoff_seconds=args.error_backoff_seconds,
            stop_hotkey=args.force_stop_hotkey,
        )
    finally:
        watcher.stop()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
