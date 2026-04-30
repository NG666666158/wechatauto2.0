from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

import uvicorn


BOOTSTRAP_PROBE_ARG = "--bootstrap-wechat-probe"
AUTO_REPLY_ARG = "--run-auto-reply"
WATCHDOG_ARG = "--emergency-stop-watchdog"


def _default_data_dir() -> str:
    configured = os.getenv("WECHAT_AI_DATA_DIR", "").strip()
    if configured:
        return configured
    appdata = os.getenv("APPDATA", "").strip()
    if appdata:
        return str(Path(appdata) / "WeChatAI" / "data")
    return str(Path.cwd() / "wechat_ai" / "data")


def main() -> None:
    if BOOTSTRAP_PROBE_ARG in sys.argv:
        from wechat_ai.app.bootstrap_probe_runner import main as bootstrap_probe_main

        index = sys.argv.index(BOOTSTRAP_PROBE_ARG)
        raise SystemExit(bootstrap_probe_main(sys.argv[index + 1 :]))
    if AUTO_REPLY_ARG in sys.argv:
        from wechat_ai.app.auto_reply_runner import main as auto_reply_main

        index = sys.argv.index(AUTO_REPLY_ARG)
        raise SystemExit(auto_reply_main(sys.argv[index + 1 :]))
    if WATCHDOG_ARG in sys.argv:
        from wechat_ai.app.emergency_stop_watchdog_runner import main as watchdog_main

        index = sys.argv.index(WATCHDOG_ARG)
        raise SystemExit(watchdog_main(sys.argv[index + 1 :]))

    parser = argparse.ArgumentParser(description="Run WeChat AI local backend")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--log-level", default="info")
    parser.add_argument("--data-dir", default=_default_data_dir())
    args = parser.parse_args()

    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    os.environ["WECHAT_AI_DATA_DIR"] = str(Path(args.data_dir).expanduser())
    Path(os.environ["WECHAT_AI_DATA_DIR"]).mkdir(parents=True, exist_ok=True)

    uvicorn.run(
        "wechat_ai.server.main:app",
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        factory=False,
    )


if __name__ == "__main__":
    main()
