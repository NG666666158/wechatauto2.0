# 桌面客户端后端接口说明

本文档说明当前仓库给网页端和未来桌面客户端预留的本地后端服务层。前端、Electron 壳和后续客户端都应只调用本地 HTTP API 或 `DesktopAppService`，不要跨层直接调用 `wechat_runtime.py`、memory、identity repository 等内部模块。

## 启动方式

开发期统一入口：

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\dev_start.ps1
```

这条命令会启动：

- 本地 FastAPI 后端：`http://127.0.0.1:8765`
- Next 前端：`http://127.0.0.1:3000`

统一 API 前缀：

```text
/api/v1
```

## 2026-04-28 接口状态更新

稳定性与一致性增强 Round 3-20 后，桌面后端已经不只是页面占位层，而是承接了发送一致性、人工审核、安全策略、SEND_UNCERTAIN 处理和 RAG 可信化的本地控制面。

新增或需要前端重点使用的接口：

- `GET /api/v1/jobs/reply`
- `POST /api/v1/jobs/reply/{reply_job_id}/approve`
- `POST /api/v1/jobs/reply/{reply_job_id}/cancel`
- `GET /api/v1/jobs/send`
- `GET /api/v1/jobs/send-uncertain`
- `GET /api/v1/jobs/send-uncertain/metrics`
- `GET /api/v1/jobs/send/{send_job_id}/attempts`
- `POST /api/v1/jobs/send/{send_job_id}/resolve`
- `GET /api/v1/settings/safety-policy/export`
- `POST /api/v1/settings/safety-policy/import`
- `POST /api/v1/settings/safety-policy/restore-defaults`
- `GET /api/v1/settings/safety-policy/audit`
- `GET /api/v1/knowledge/trust-diagnostics`
- `POST /api/v1/knowledge/trusted-rebuild`
- `GET /api/v1/debug/knowledge-acceptance/history`

关键约束：

- 前端仍不直接操控微信 UI。
- 人工审核批准后的真实发送必须继续走 `SendCoordinator`。
- `SEND_UNCERTAIN` 不允许自动重发，只能由人工确认、标记失败或恢复会话。
- fake / untrusted RAG 不允许直接进入真实自动发送链路。

统一响应结构：

```json
{
  "success": true,
  "data": {},
  "error": null,
  "trace_id": "..."
}
```

## 运行时启动原则

网页端和桌面客户端的“开始自动回复”必须走三段式安全流程：

1. `POST /api/v1/runtime/bootstrap-check`
2. 用户确认
3. `POST /api/v1/runtime/bootstrap-start`

停止自动回复时使用：

- `POST /api/v1/runtime/stop`
- `POST /api/v1/runtime/force-stop`

重要约束：

- 不要把用户可点击的“开始自动回复”直接接到 `POST /api/v1/runtime/start`。
- `POST /api/v1/runtime/start` 仅作为底层兼容入口保留，后续可标记为 deprecated。
- `bootstrap-start` 会复用这次真实微信环境验证过的桌面权限路径，避免网页端、Electron 壳和手动脚本各走一套不同逻辑。
- 后端服务本身不应被“停止自动回复”杀掉；停止只应结束真实微信轮询子进程。

## 核心模块

- [wechat_ai/app/service.py](/C:/github/pywechat/pywechat-main/pywechat-main/wechat_ai/app/service.py)：桌面客户端服务边界。
- [wechat_ai/server/main.py](/C:/github/pywechat/pywechat-main/pywechat-main/wechat_ai/server/main.py)：FastAPI 应用入口。
- [wechat_ai/server/api/](/C:/github/pywechat/pywechat-main/pywechat-main/wechat_ai/server/api)：HTTP 路由。
- [wechat_ai/server/services/runtime_manager.py](/C:/github/pywechat/pywechat-main/pywechat-main/wechat_ai/server/services/runtime_manager.py)：运行态生命周期管理。

## 已可接入接口

基础检查：

- `GET /api/v1/ping`
- `GET /api/v1/health`

首页与运行控制：

- `GET /api/v1/dashboard/summary`
- `GET /api/v1/runtime/status`
- `POST /api/v1/runtime/bootstrap-check`
- `POST /api/v1/runtime/bootstrap-start`
- `POST /api/v1/runtime/stop`
- `POST /api/v1/runtime/force-stop`
- `POST /api/v1/runtime/restart`

设置页：

- `GET /api/v1/settings`
- `PATCH /api/v1/settings`

客户与身份：

- `GET /api/v1/customers`
- `GET /api/v1/customers/{customer_id}`
- `GET /api/v1/identity/drafts`
- `GET /api/v1/identity/candidates`
- `GET /api/v1/identity/self/global`
- `PATCH /api/v1/identity/self/global`

消息页：

- `GET /api/v1/conversations`
- `GET /api/v1/conversations/{conversation_id}`
- `POST /api/v1/conversations/{conversation_id}/suggest`
- `POST /api/v1/conversations/{conversation_id}/send`

知识库：

- `GET /api/v1/knowledge/status`
- `GET /api/v1/knowledge/search?q=...&limit=3`
- `POST /api/v1/knowledge/import`
- `POST /api/v1/knowledge/web-build`

运维、隐私与环境检查：

- `GET /api/v1/logs/recent?limit=20`
- `GET /api/v1/privacy/policy`
- `PATCH /api/v1/privacy/policy`
- `POST /api/v1/privacy/apply-retention`
- `GET /api/v1/environment/wechat`

会话控制：

- `GET /api/v1/controls/conversations/{conversation_id}`
- `PATCH /api/v1/controls/conversations/{conversation_id}`

## 当前数据策略

主要本地数据文件：

- `wechat_ai/data/app/desktop_settings.json`
- `wechat_ai/data/app/daemon_state.json`
- `wechat_ai/data/app/conversations.json`
- `wechat_ai/data/logs/runtime_events.jsonl`
- `wechat_ai/data/knowledge/local_knowledge_index.json`

隐私与保留策略：

- structured log 默认脱敏。
- recent logs 接口会再次脱敏并限制返回数量。
- runtime logs 支持按天数清理。
- memory 文件按快照数量裁剪，避免长期无限增长。
- API key、token、password、secret、authorization 等字段不应明文进入日志。

## 回归测试模板

后续重复验证这套路线时，统一使用：

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\runtime_web_smoke_1min.ps1
```

该脚本会执行：

1. 强制停止旧的自动回复子进程。
2. 调用 `bootstrap-check`。
3. 调用 `bootstrap-start`。
4. 运行约 1 分钟。
5. 调用 `runtime/stop`。
6. 打印近期运行事件和本地会话写入结果。

验收重点：

- 启动前不会自动抢占微信焦点。
- 只有用户确认后才进入真实轮询。
- 停止按钮只停止自动回复轮询，不杀死后端和前端。
- 单聊和群聊消息按真实顺序写入本地会话。
- 机器人回复写入右侧，用户消息写入左侧。
