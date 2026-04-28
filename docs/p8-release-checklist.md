# P8 Release Checklist

后续开发优先级和统一收尾路线请看：[后续开发计划与收尾路线图](./后续开发计划与收尾路线图.md)。

## 2026-04-28 稳定性收尾补充

发布前除原 P8 检查外，还必须确认 Round 3-20 的稳定性增强闭环：

- `SEND_UNCERTAIN` 不会自动重发，人工处理后有状态和审计记录。
- 安全策略配置化可导出、导入、恢复默认，并记录 audit trail。
- Pending 审核页能展示风险等级、原因码，并支持批准后进入 `SendCoordinator`。
- 普通低风险消息不会因为知识库 fake/untrusted 被默认放进待审核；只有命中安全词或高风险规则时才进入人工审核。
- RAG Trust Gate 能展示 fake / untrusted / trusted、真实发送阻断状态和推荐动作。
- `POST /api/v1/knowledge/trusted-rebuild` 能在 trusted provider 可用时重建可信索引。
- 统一验收入口 `py -3 scripts\run_desktop_acceptance_flow.py --skip-http --skip-runtime-smoke --format pretty` 通过。
- 前端生产构建 `npm run build` 通过，且没有遗留 Next 自动修改的 `next-env.d.ts` / `tsconfig.json` 噪音。

建议最终发布前新增一次真实微信人工验收：

- 启动服务：`powershell.exe -ExecutionPolicy Bypass -File scripts\dev_start.ps1 -Restart`
- 前端打开：`http://127.0.0.1:3000`
- 后端检查：`http://127.0.0.1:8765/api/v1/ping`
- 在真实微信窗口中验证 bootstrap-check、审核发送、SEND_UNCERTAIN 处理和停止流程。

## 发布门槛

- 身份提示词证据已验证。
- 知识库检索证据已验证。
- Electron 设置页可见并可编辑“开机自启”“定时巡检间隔”。
- 30 分钟冒烟通过。
- 2 小时稳定性通过。
- 8 小时长跑通过。

## 发布前检查

### 客户端与桌面壳

- `py -3 scripts/run_p8_shell_acceptance.py --frontend-url http://127.0.0.1:3000/settings --format pretty`
- Electron 窗口诊断事件正常输出：
  - `window.did_start_loading`
  - `window.dom_ready`
  - `window.did_finish_load`
  - `window.did_fail_load`

### 身份与知识链路

- `GET /api/v1/debug/prompt-preview` 可看到当前身份事实注入。
- `GET /api/v1/debug/knowledge-acceptance` 可看到 chunk 命中证据。
- 身份页、知识库页、设置页的关键入口均可访问。

### 稳定性

- `py -3 scripts/run_p8_acceptance.py --preset smoke --format pretty`
- 诊断报告中的 `loop_error`、`message_send_unconfirmed`、`active_anchor_missed` 有明确归因。
- 无重复发送、无不可恢复 stop 状态、无失控日志增长。
