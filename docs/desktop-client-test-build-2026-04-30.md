# 桌面客户端测试版开发更新（2026-04-30）

本轮目标是把网页端的前后端能力收口到 Windows 桌面客户端测试版中，让用户解压或运行 exe 后，可以在客户端里完成本地服务启动、微信环境检测、模型配置、知识库入库、身份设定和自动回复控制。

## 本轮已完成

### 1. 客户端壳子与打包

- Electron 客户端改为无边框窗口，使用自定义最小化、最大化、关闭按钮。
- 关闭按钮默认退到后台，完全退出通过系统托盘菜单完成。
- 左侧导航支持展开和收起，收起状态下点击图标可直接跳转，不会自动展开。
- 生产包加载静态前端产物，不再依赖 `localhost:3000`。
- Electron 会拉起本地后端 `wechat-ai-backend.exe`，后端数据目录指向用户数据目录。
- 新增打包脚本：
  - `scripts/build_backend_exe.ps1`
  - `scripts/build_test_client.ps1`
  - `scripts/package_unpacked_client.ps1`
- 新增便携测试包输出：
  - `dist/client/WeChatAI-TestClient-win-x64.zip`
  - `dist/client/客户版微信自动回复桌面应用 0.1.0-test.exe`

### 2. 托盘与状态同步

- 托盘图标已改为应用内置图标，不再显示空白图标。
- 客户端启动后可从托盘双击恢复主窗口。
- 首页运行状态现在会定时刷新，并在窗口聚焦或可见性变化时重新拉取真实状态。
- 后端增加守护进程状态校正：
  - 强制停止标记存在时，状态自动修正为 `stopped`。
  - 子进程已退出时，状态自动修正为 `stopped`。
  - 运行状态长时间没有心跳时，状态自动修正为 `stopped`。
- 修复强制停止后重新进入客户端仍显示“停止自动回复”的问题。

### 3. 首页启动流程

- 首页快捷操作保留四个核心入口：
  - 本地服务
  - 检测微信环境
  - 确认开始/停止自动回复
  - 刷新运行状态
- 检测微信环境前增加确认提示，说明可能会拉起讲述人和微信登录流程。
- 启动自动回复前增加三段确认提示：
  - 会占用鼠标和键盘。
  - 会拉起本地轮询脚本。
  - 强调优先用页面停止按钮，紧急情况使用 `Ctrl+Shift+F12`。

### 4. 消息记录页

- 消息页只作为记录页，不提供发送消息入口。
- 会话列表和消息内容区域都支持滚动查看。
- 会话列表右侧原红色数量徽标已移除，避免误解为未读消息。
- 当前改为在时间左侧显示浅色文案：`记录 n 条`。
- 中间聊天区展示完整消息记录，用户消息和 AI 回复按气泡区分。
- AI 回复标识统一为“AI 回复”。

### 5. 待处理页与风险拦截

- 待处理页只保留中高风险的人工审核内容。
- 删除重复且占空间的风险概览区。
- 低风险普通记录不再进入待审核列表。
- 模型生成后如果被安全策略、知识库可信门禁或发送确认拦截，会记录为待人工检查的发送任务。
- 待处理页的发送记录现在展示多条拦截尝试，不再只显示最后一条。

### 6. 客户与身份

- 客户页保留客户列表、客户详情和全局自我身份。
- 客户详情中的“备注”改为“用户身份”，更贴近模型回复依据。
- 客户详情字段改为纵向排列，减少拥挤。
- 全局自我身份支持保存和 AI 生成。
- 默认全局身份名称改为“陪聊机器人”。
- 大模型回复时会统一带入：
  - 全局自我身份
  - 当前客户身份
  - 会话上下文
  - 知识库检索结果

### 7. 模型配置

- 设置页新增模型服务配置。
- 当前先支持 MiniMax API Key。
- 默认模型适配 MiniMax M2.7。
- 未配置 API Key 时，不能启动真实模型自动回复。
- API Key 只在本地配置中保存，前端展示时做脱敏。

### 8. 知识库初版

- 支持本地文件拖拽入库。
- 支持 `txt`、`md`、`json`、`pdf`、`docx`、常见图片等格式。
- 新增语义切分加固定重叠字符的切片方式。
- 检索结果改为弹窗展示，不在页面常驻占位。
- 删除知识库可信门禁大块展示，减少新手理解负担。
- 打包时补充 `docx`、`pypdf`、`lxml` 等解析依赖，避免新电脑无法解析文档。

### 9. 微信回复格式

- 回复进入微信前会做普通文本格式化。
- 去除 Markdown 标题、列表符号、粗体、代码块、链接等格式。
- 提示词也明确要求模型不要输出 Markdown。
- 目标是在微信里显示自然聊天文本，而不是文档格式。

## 当前验证结果

本轮已执行并通过：

```powershell
python scripts\test_wechat_ai_reply_formatter_unit.py
python scripts\test_wechat_ai_reply_pipeline_unit.py
python scripts\test_wechat_ai_prompt_builder_unit.py
python scripts\test_wechat_ai_unit.py
python scripts\test_wechat_ai_app_service_unit.py
python scripts\test_wechat_ai_server_unit.py
python scripts\test_backend_entry_unit.py
npm run smoke:p7
npm run build:static
powershell -ExecutionPolicy Bypass -File scripts\build_test_client.ps1
powershell -ExecutionPolicy Bypass -File scripts\package_unpacked_client.ps1
```

## 当前测试包

测试版客户端压缩包：

```text
dist/client/WeChatAI-TestClient-win-x64.zip
```

便携 exe：

```text
dist/client/客户版微信自动回复桌面应用 0.1.0-test.exe
```

## 仍需人工确认

- 在新 Windows 电脑上首次启动能否正常拉起本地后端。
- 微信已登录、微信未登录、微信窗口不可见三种场景下的检测体验。
- 真实微信运行 30 分钟以上后是否稳定。
- 文档入库在新电脑上是否覆盖常见 `docx/pdf/txt/md/json/图片` 场景。
- MiniMax API Key 首次配置后的真实模型回复链路。
- 强制停止、页面停止、托盘退出三种停止路径是否符合预期。

## 下一轮建议

- 为正式发布准备稳定的应用图标文件，并接入 electron-builder 的 `win.icon`。
- 增加首次启动向导，引导用户依次配置模型、检测微信、导入知识库。
- 增加客户端内日志导出按钮，便于定位新电脑问题。
- 将 MiniMax 之外的模型供应商做成可选项。
- 做一次干净机器验收，确认 zip 解压即用的真实体验。
