# 知识库构建开发文档

## 目标

把桌面端知识库从“能导入、能检索”的基础能力，逐步升级为适合微信自动回复场景的 RAG 构建流程：可导入多格式资料、稳定抽取文本、按语义边界切分、构建可追溯索引、支持真实语义向量检索，并在必要时由大模型辅助整理资料边界。

## 当前已支持能力

### 文件格式

本地文件入库支持以下格式：

- 文本：`.txt`、`.md`
- 结构化文本：`.json`
- 文档：`.pdf`、`.docx`
- 图片 OCR：`.png`、`.jpg`、`.jpeg`、`.bmp`、`.gif`、`.webp`

当前限制：

- `.json` 主要读取 `text` 字段。
- `.pdf` 主要依赖 PDF 内可提取文本，扫描版 PDF 需要 OCR 能力补强。
- 图片走 Windows OCR，识别质量受图片清晰度、语言、方向影响。
- 所有文件抽取后会转成 Markdown，再进入索引构建。

### 构建流程

当前流程为：

1. 用户提交本地文件路径。
2. 后端复制原始文件到 `wechat_ai/data/knowledge/uploads/originals/`。
3. 文本抽取结果写入 `wechat_ai/data/knowledge/uploads/extracted/`。
4. 抽取后的 Markdown 进入知识索引构建。
5. 索引写入 `wechat_ai/data/knowledge/local_knowledge_index.json`。
6. 检索时使用混合检索：向量召回 + 关键词召回。

### 切分策略

本轮已把硬字符切分升级为递归切分：

- 优先按段落切分：`\n\n`
- 再按换行切分：`\n`
- 再按中文句读切分：`。`、`；`、`，`
- 再按空格切分
- 最后才回退到固定长度字符窗口

默认参数：

- `chunk_size=1000`
- `overlap=200`
- `chunk_strategy=semantic_overlap`

新增 `semantic_overlap` 策略：先按段落、换行、句号、问号、感叹号、分号等语义边界合并切片，再给相邻切片补固定字符重叠。旧的 `recursive` 策略保留，可用于兼容测试或手动重建。

索引中会记录：

- 顶层 `chunk_strategy`
- 每个片段 metadata 中的 `chunk_strategy`
- `chunk_size`
- `overlap`
- `embedding_provider`
- `embedding_trusted`

## 当前检索能力评估

当前混合检索结构是合理的，但语义向量仍处于测试级：

- `FakeEmbeddings`：哈希向量，仅适合本地测试。
- `TrustedLocalEmbeddings`：仍是本地测试向量，只用于可信门禁流程验证。

因此当前“关键词命中”比“语义理解”更可靠。正式回复质量要提升，下一阶段必须接入真实 embedding provider。

## 是否需要大模型参与构建

需要，但不应该第一步就让大模型重写所有资料。

优先级建议：

1. 真实 Embedding：提升语义召回质量，是 RAG 的核心。
2. 递归/语义切分：避免政策、FAQ、话术被硬切断。
3. 元数据与来源追踪：保证回复可追溯。
4. 大模型辅助清洗：用于生成 FAQ、边界规则、不能承诺事项、人工接入条件。
5. 大模型重排或答案校验：用于提升命中片段排序和回复安全性。

## 开发流程规划

### 阶段一：稳定构建基础

已完成：

- 递归切分器。
- 中文句读标点保留。
- 索引写入切分策略元数据。
- 单元测试覆盖段落优先切分、中文标点保留、索引策略记录。

后续可补：

- 前端展示每次入库的片段数。
- 文档入库失败时显示更直观的失败原因。
- 支持删除单个已入库文档并重建索引。

### 阶段二：真实 Embedding 接入

目标：

- 新增真实向量 provider，例如 OpenAI、MiniMax 或本地 bge/m3e。
- 构建索引和检索查询必须使用同一 provider。
- 索引记录 provider、维度、模型名、构建时间。

建议接口：

- `WECHATAUTO_EMBEDDING_PROVIDER=openai|minimax|local_bge|fake`
- `WECHATAUTO_EMBEDDING_MODEL=...`
- `WECHATAUTO_EMBEDDING_API_KEY=...`

验收标准：

- 同义问题能命中同一 FAQ。
- 不包含原关键词的问题也能命中相关片段。
- provider 不匹配时提示重新构建索引。

### 阶段三：构建任务化

目标：

- 入库从同步请求升级为任务。
- 每个任务记录阶段：抽取、清洗、切分、向量化、索引、验收。
- 前端展示最近任务进度和失败原因。

任务状态建议：

- `queued`
- `extracting`
- `chunking`
- `embedding`
- `indexing`
- `completed`
- `failed`

### 阶段四：大模型辅助整理

目标：

- 用户可选择“AI 优化入库”。
- 模型从文档中提取：
  - FAQ
  - 服务范围
  - 可承诺事项
  - 禁止承诺事项
  - 需要人工确认的问题
  - 适用条件与例外

原则：

- AI 生成结果必须让用户确认后再入库。
- 保留原文来源和片段引用。
- 不能只保存大模型总结而丢掉原文证据。

### 阶段五：检索验收与质量报告

目标：

- 用户输入测试问题。
- 系统返回命中片段、来源文件、相关度、召回方式。
- 保存验收记录，但前端默认不占主页面空间，可放在弹窗或最近任务详情中。

验收指标：

- 命中率：测试问题是否能命中正确文档。
- 可追溯：每条命中是否有来源文件和片段序号。
- 可解释：能看到关键词/语义召回来源。
- 安全性：不可信索引不直接支撑高风险自动回复。

## 本轮代码落地

修改文件：

- `wechat_ai/rag/chunker.py`
- `wechat_ai/rag/ingest.py`
- `scripts/test_wechat_ai_rag_chunking_unit.py`
- `scripts/test_wechat_ai_rag_retrieval_unit.py`

实现内容：

- 将 `Chunker` 改为递归切分策略。
- 保留中文句号、分号、逗号等边界符号。
- 长文本无自然边界时回退到固定窗口切分，并保留 overlap。
- 索引顶层和每个片段 metadata 写入 `chunk_strategy=semantic_overlap`，兼容旧的 `recursive` 策略。

验证命令：

```powershell
python scripts\test_wechat_ai_rag_chunking_unit.py
python scripts\test_wechat_ai_rag_retrieval_unit.py
python scripts\test_wechat_ai_knowledge_importer_unit.py
```
## 本轮并行开发新增能力

本轮已在三条开发支线上继续推进：

1. 真实向量模型接入
   - 新增 `openai_compatible` embedding provider。
   - 支持通过 `WECHATAUTO_EMBEDDING_PROVIDER`、`WECHATAUTO_EMBEDDING_BASE_URL`、`WECHATAUTO_EMBEDDING_API_KEY`、`WECHATAUTO_EMBEDDING_MODEL`、`WECHATAUTO_EMBEDDING_TIMEOUT`、`WECHATAUTO_EMBEDDING_DIMENSIONS` 配置真实向量接口。
   - 默认仍为 `fake`，所以本地无配置运行不会联网。

2. 知识库构建任务记录
   - 新增本地 JSON 任务记录，覆盖本地文件入库、联网扩库、可信向量重建、AI 入库预处理。
   - 新增 `GET /api/v1/knowledge/tasks`，前端“最近任务”改为读取后端记录。
   - 任务记录包含类型、状态、摘要、错误原因、更新时间和元数据，适合后续展示构建进度。

3. AI 入库预处理预览
   - 新增 preview-only 结构化预处理能力。
   - 新增 `POST /api/v1/knowledge/ai-normalize-preview`。
   - 输出 FAQ、可确认事实、禁止承诺事项、人工介入规则、来源摘录和风险提示。
   - 当前不会直接写入索引，必须后续由用户确认后再进入入库流程。

当前完成后，知识库构建与检索可以达到：

- 多格式文件抽取后进入递归切分和可追溯索引。
- 可使用默认测试向量完成本地验证，也可切换 OpenAI-compatible 真实向量提升语义召回。
- 检索结果能展示来源、分数、召回方式和向量可信状态。
- 构建动作会形成最近任务记录，便于桌面端查看成功、失败和复核状态。
- AI 预处理可以先生成结构化知识边界，但不会绕过用户确认直接污染知识库。
