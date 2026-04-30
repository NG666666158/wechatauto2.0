from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class ReplyFormatterTests(unittest.TestCase):
    def test_format_reply_for_wechat_removes_common_markdown(self) -> None:
        from wechat_ai.orchestration.reply_formatter import format_reply_for_wechat

        raw = (
            "请情况确实燃眉，野区被反烂经济直接拉开 给你几个思路：\n"
            "1. **换开野路线** - 如果蓝区被反就去红开。\n"
            "2. **叫队友协防** - 进游戏前打字让辅助或中单帮忙看。\n"
            "- 不要硬打。\n"
            "`先稳住节奏`"
        )

        formatted = format_reply_for_wechat(raw)

        self.assertNotIn("**", formatted)
        self.assertNotIn("`", formatted)
        self.assertNotIn("- 不要", formatted)
        self.assertIn("1. 换开野路线 - 如果蓝区被反就去红开。", formatted)
        self.assertIn("不要硬打。", formatted)
        self.assertIn("先稳住节奏", formatted)

    def test_format_reply_for_wechat_removes_headings_code_fences_and_links(self) -> None:
        from wechat_ai.orchestration.reply_formatter import format_reply_for_wechat

        raw = "### 回复\n[查看政策](https://example.com)\n```text\n普通话术\n```"

        self.assertEqual(format_reply_for_wechat(raw), "回复\n查看政策\n普通话术")


if __name__ == "__main__":
    unittest.main()
