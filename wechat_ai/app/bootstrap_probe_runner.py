from __future__ import annotations

import argparse
from dataclasses import asdict
import json
import os
from pathlib import Path
import sys

from wechat_ai.app.wechat_bootstrap import (
    BootstrapSettings,
    WeChatFirstRunBootstrapper,
    is_process_running,
    parse_guardian_command,
)

_ENTER_WECHAT_CLICKED = False


def configure_comtypes_cache(base_dir: str | Path) -> str:
    cache_dir = Path(base_dir).resolve() / ".cache" / "comtypes"
    cache_dir.mkdir(parents=True, exist_ok=True)
    try:
        from comtypes.client import _code_cache
    except Exception:
        return str(cache_dir)

    original_create = _code_cache._create_comtypes_gen_package

    def _app_gen_dir() -> str:
        original_create()
        from comtypes import gen

        gen_path = list(gen.__path__)
        if str(cache_dir) not in gen_path:
            gen_path.append(str(cache_dir))
            gen.__path__ = gen_path
        return str(cache_dir)

    _code_cache._find_gen_dir = _app_gen_dir
    os.environ.setdefault("PYWECHAT_COMTYPES_CACHE", str(cache_dir))
    return str(cache_dir)


def _ui_ready_check() -> dict[str, object]:
    checks: dict[str, object] = {}
    errors: dict[str, str] = {}
    _reset_wechat_window_cache()
    if _click_enter_wechat_if_present():
        checks["enter_wechat_clicked"] = True
        return {"ready": False, "checks": checks, "errors": errors}
    try:
        from pyweixin.WeChatTools import Navigator

        main_window = Navigator.open_weixin(is_maximize=False)
        checks["main_window"] = {
            "handle": int(getattr(main_window, "handle", 0) or 0),
            "class_name": main_window.class_name(),
        }
        return {"ready": True, "checks": checks, "errors": errors}
    except Exception as exc:
        errors["main_window"] = f"{type(exc).__name__}: {exc}"
        checks["state"] = type(exc).__name__
    if _probe_pyweixin_functional_ready(checks, errors):
        return {"ready": True, "checks": checks, "errors": errors}
    return {"ready": False, "checks": checks, "errors": errors}


def _probe_pyweixin_functional_ready(checks: dict[str, object], errors: dict[str, str]) -> bool:
    functional_checks: dict[str, object] = {}

    def record_error(label: str, exc: Exception) -> None:
        errors[label] = f"{type(exc).__name__}: {exc}"

    try:
        from pyweixin import Contacts, Messages

        try:
            profile = Contacts.check_my_info(close_weixin=False)
            if profile:
                functional_checks["my_profile"] = profile
        except Exception as exc:
            record_error("check_my_info", exc)

        try:
            sessions = Messages.dump_recent_sessions(recent="Today", chat_only=False, close_weixin=False)
            if isinstance(sessions, list):
                functional_checks["recent_sessions"] = sessions[:3]
        except Exception as exc:
            record_error("dump_recent_sessions", exc)

        try:
            new_messages = Messages.check_new_messages(close_weixin=False)
            if new_messages is not None:
                functional_checks["new_messages"] = new_messages
        except Exception as exc:
            record_error("check_new_messages", exc)
    except Exception as exc:
        record_error("import_pyweixin_functional", exc)

    if not functional_checks:
        return False
    checks["functional_ready"] = True
    checks["functional_checks"] = functional_checks
    return True


def _reset_wechat_window_cache() -> None:
    try:
        from pyweixin.WeChatTools import wx

        wx.hwnd = 0
        wx.possible_windows = []
        wx.window_type = 1
    except Exception:
        pass


def _click_enter_wechat_if_present() -> bool:
    global _ENTER_WECHAT_CLICKED
    if _ENTER_WECHAT_CLICKED:
        return False
    try:
        from pyweixin.WeChatTools import desktop, wx

        _reset_wechat_window_cache()
        handle = wx.find_wx_window()
        if not handle:
            return False
        window = desktop.window(handle=handle)
        enter_button = window.child_window(title="进入微信", control_type="Button")
        if not enter_button.exists(timeout=0.1):
            return False
        print("[bootstrap] 检测到进入微信按钮，点击后继续等待主界面。", flush=True)
        enter_button.click_input()
        _ENTER_WECHAT_CLICKED = True
        return True
    except Exception:
        return False


def _locate_wechat_path() -> str:
    try:
        from pyweixin import Tools

        detected = str(Tools.where_weixin(copy_to_clipboard=False) or "").strip()
        if detected:
            return detected
    except Exception:
        pass
    for candidate in (
        Path(r"C:\Weixin\Weixin.exe"),
        Path.home() / r"AppData\Local\Tencent\Weixin\Weixin.exe",
        Path.home() / r"AppData\Roaming\Tencent\Weixin\Weixin.exe",
    ):
        if candidate.exists():
            return str(candidate)
    return r"C:\Weixin\Weixin.exe"


def _is_wechat_running() -> bool:
    try:
        from pyweixin import Tools

        if bool(Tools.is_weixin_running()):
            return True
    except Exception:
        pass
    return any(is_process_running(name) for name in ("Weixin.exe", "WeChat.exe", "WeChatAppEx.exe"))


def _is_wechat_window_available() -> bool:
    try:
        from pyweixin.WeChatTools import wx

        return bool(_is_wechat_running() and wx.find_wx_window())
    except Exception:
        return False


def _configure_console_output() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="backslashreplace")


def main(argv: list[str] | None = None) -> int:
    _configure_console_output()
    data_dir = Path(os.getenv("WECHAT_AI_DATA_DIR", "") or Path.cwd() / "wechat_ai" / "data")
    configure_comtypes_cache(data_dir)

    from pyweixin import GlobalConfig

    parser = argparse.ArgumentParser(description="检测微信登录状态和主界面可用性。")
    parser.add_argument("--ready-timeout", type=float, default=300.0)
    parser.add_argument("--poll-interval", type=float, default=2.0)
    parser.add_argument("--narrator-settle-seconds", type=float, default=5.0)
    parser.add_argument("--wechat-path", default="")
    parser.add_argument("--narrator-path", default="")
    parser.add_argument("--no-auto-stop-narrator", action="store_true")
    parser.add_argument("--no-start-guardian", action="store_true")
    parser.add_argument("--wait-for-ui-ready", action="store_true")
    parser.add_argument("--guardian-command", default="")
    args = parser.parse_args(argv)

    GlobalConfig.close_weixin = False
    GlobalConfig.is_maximize = False

    project_root = Path.cwd()
    guardian_command = parse_guardian_command(args.guardian_command, project_root)
    bootstrapper = WeChatFirstRunBootstrapper(
        ui_ready_check=_ui_ready_check,
        status_callback=lambda message: print(f"[bootstrap] {message}", flush=True),
        locate_wechat_path=lambda: args.wechat_path.strip() or _locate_wechat_path(),
        is_wechat_running=_is_wechat_running,
        is_wechat_window_available=_is_wechat_window_available,
    )
    result = bootstrapper.run(
        BootstrapSettings(
            ready_timeout_seconds=args.ready_timeout,
            ready_poll_interval_seconds=args.poll_interval,
            narrator_settle_seconds=args.narrator_settle_seconds,
            auto_stop_narrator_on_success=not args.no_auto_stop_narrator,
            start_guardian=not args.no_start_guardian,
            wait_for_ui_ready_before_guardian=args.wait_for_ui_ready,
            guardian_command=guardian_command,
            wechat_path=args.wechat_path,
            narrator_path=args.narrator_path,
        )
    )
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    return 0 if result.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
