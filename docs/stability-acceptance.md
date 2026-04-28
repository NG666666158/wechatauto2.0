# 稳定性验收入口

本文档说明稳定性增强后的安全验收命令。完整后续路线图请看：[后续开发计划与收尾路线图](./后续开发计划与收尾路线图.md)。

## 只检查源码

后端没有启动时使用：

```powershell
py -3 scripts\run_stability_acceptance.py --skip-http --format pretty
```

## 后端接口检查

本地后端启动后使用：

```powershell
py -3 scripts\run_stability_acceptance.py --base-url http://127.0.0.1:8765/api/v1 --format pretty
```

该脚本适合发布前预检：不会调用真实发送接口，也不会操作微信窗口。大部分检查是读取接口；可信知识库重建探针可能调用 `POST /api/v1/knowledge/trusted-rebuild`，只有在配置了可信向量提供方时才会重建本地知识库索引。

## 统一桌面验收流程

需要一份统一报告，并跳过可选真实运行检查时使用：

```powershell
py -3 scripts\run_desktop_acceptance_flow.py --skip-http --skip-runtime-smoke --format pretty
```

本地后端启动后，把后端接口检查也纳入同一份报告：

```powershell
py -3 scripts\run_desktop_acceptance_flow.py --base-url http://127.0.0.1:8765/api/v1 --skip-runtime-smoke --format pretty
```

统一流程会输出一份报告，包含每一步命令、退出码、通过/跳过状态和摘要。真实运行冒烟默认关闭；如果传入 `--run-runtime-smoke`，会调用 `scripts\runtime_web_smoke_1min.ps1`，启动并停止运行时，并依赖人工注入测试消息。该流程不会自动发送微信消息。

## 覆盖的检查项

- 发送前检查存在，并能显示 `SEND_UNCERTAIN` 阻断。
- `SEND_UNCERTAIN` 指标包含未解决数量、最近 24 小时数量、主要错误码和主要会话。
- 安全策略审计会记录规则组变更和恢复默认事件。
- 安全词命中时，回复进入人工审核。
- 普通低风险消息不会因为知识库 fake/untrusted 被默认拦截。
- RAG 可信诊断能展示真实发送阻断状态、可信重建可用性、提供方和推荐动作。
- `POST /api/v1/knowledge/trusted-rebuild` 可用于可信知识库重建，并且不触发微信消息发送。
- 首页风险概览仍然连接到前端接口客户端。

## Round 20 状态

截至 2026-04-28，稳定性验收已包含 Round 20 的可信知识库重建流程：

- `GET /api/v1/knowledge/trust-diagnostics`
- `POST /api/v1/knowledge/trusted-rebuild`
- `GET /api/v1/debug/knowledge-acceptance/history`

启动服务前使用源码检查；`scripts/dev_start.ps1` 报告前后端 ready 后，再运行后端接口检查。
