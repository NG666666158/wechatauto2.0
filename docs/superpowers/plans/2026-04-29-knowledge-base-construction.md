# Knowledge Base Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the WeChat desktop knowledge base from basic file import into a staged RAG construction pipeline with reliable chunking, provider-aware embeddings, task visibility, and optional AI-assisted cleanup.

**Architecture:** Keep the current `KnowledgeImporter -> build_knowledge_index -> HybridRetriever` flow, but harden each boundary. The first shipped slice improves chunking and index metadata without adding external dependencies; later slices add real embedding providers, background tasks, and AI-assisted document normalization.

**Tech Stack:** Python FastAPI backend, local JSON index, existing RAG modules under `wechat_ai/rag`, Next.js desktop frontend.

---

### Task 1: Recursive Chunking Foundation

**Files:**
- Modify: `wechat_ai/rag/chunker.py`
- Modify: `wechat_ai/rag/ingest.py`
- Test: `scripts/test_wechat_ai_rag_chunking_unit.py`
- Test: `scripts/test_wechat_ai_rag_retrieval_unit.py`

- [x] **Step 1: Add failing tests for semantic-ish boundaries**

Add tests proving paragraph boundaries are preferred before character windows and Chinese sentence punctuation is preserved.

- [x] **Step 2: Run tests and verify failure**

Run:

```powershell
python scripts\test_wechat_ai_rag_chunking_unit.py
python scripts\test_wechat_ai_rag_retrieval_unit.py
```

Expected before implementation: chunking test fails because old implementation hard-splits characters; retrieval test fails because `chunk_strategy` is absent.

- [x] **Step 3: Implement recursive chunking**

Implement `Chunker.strategy = "recursive"` and split by paragraph, newline, Chinese punctuation, space, then fixed windows.

- [x] **Step 4: Record strategy metadata in indexes**

Write `chunk_strategy` at index top level and in each chunk metadata.

- [x] **Step 5: Verify**

Run:

```powershell
python scripts\test_wechat_ai_rag_chunking_unit.py
python scripts\test_wechat_ai_rag_retrieval_unit.py
python scripts\test_wechat_ai_knowledge_importer_unit.py
```

Expected: all pass.

### Task 2: Real Embedding Provider Interface

**Files:**
- Modify: `wechat_ai/config.py`
- Modify: `wechat_ai/rag/embeddings.py`
- Modify: `wechat_ai/app/knowledge_importer.py`
- Test: `scripts/test_wechat_ai_profile_config_unit.py`
- Test: `scripts/test_wechat_ai_rag_retrieval_unit.py`

- [ ] **Step 1: Add config tests**

Add test cases for:

```python
WECHATAUTO_EMBEDDING_PROVIDER=openai
WECHATAUTO_EMBEDDING_MODEL=text-embedding-3-small
WECHATAUTO_EMBEDDING_API_KEY=dummy-test-key
```

Expected: `EmbeddingSettings.from_env()` returns provider, model, api key, and timeout.

- [ ] **Step 2: Add provider abstraction**

Add provider classes implementing `BaseEmbeddings`:

- `OpenAIEmbeddings`
- `MiniMaxEmbeddings` if MiniMax embedding endpoint is selected later

Keep `FakeEmbeddings` as default for local tests.

- [ ] **Step 3: Persist model metadata**

Index payload must include:

```json
{
  "embedding_provider": "OpenAIEmbeddings",
  "embedding_model": "text-embedding-3-small",
  "embedding_dimensions": 1536,
  "embedding_trusted": true
}
```

- [ ] **Step 4: Verify provider mismatch behavior**

Add a test that query-time provider mismatch returns a clear rebuild-needed signal before search results are trusted for real replies.

### Task 3: Knowledge Build Tasks

**Files:**
- Create: `wechat_ai/app/knowledge_tasks.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/knowledge.py`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [ ] **Step 1: Add task model**

Create fields:

```python
task_id: str
status: str
stage: str
created_at: str
updated_at: str
file_names: list[str]
error_message: str
result: dict[str, object]
```

- [ ] **Step 2: Record build stages**

Stages:

- `queued`
- `extracting`
- `chunking`
- `embedding`
- `indexing`
- `completed`
- `failed`

- [ ] **Step 3: Expose task list API**

Add:

```http
GET /api/v1/knowledge/tasks
```

Return recent tasks for the frontend “最近任务” card.

- [ ] **Step 4: Frontend task display**

Replace purely local `importResult/webResult` rendering with backend task records. Keep page compact: no separate history panel.

### Task 4: AI-Assisted Knowledge Cleanup

**Files:**
- Create: `wechat_ai/rag/ai_normalizer.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/knowledge.py`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [ ] **Step 1: Add preview-only cleanup API**

Add:

```http
POST /api/v1/knowledge/ai-normalize-preview
```

Input: extracted text and document title. Output: FAQ items, allowed claims, forbidden claims, human handoff rules.

- [ ] **Step 2: Require user confirmation**

Do not write AI-normalized content into the index until user confirms.

- [ ] **Step 3: Preserve source references**

Each normalized item must include source title and source text excerpt.

### Task 5: Retrieval Acceptance Report

**Files:**
- Modify: `wechat_ai/app/service.py`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `desktop_app/frontend/tests/p5-frontend-acceptance.mjs`

- [ ] **Step 1: Keep acceptance out of main layout**

Acceptance history should not render as a persistent page card. Use a dialog or recent task detail.

- [ ] **Step 2: Store compact report**

Store query, top chunks, source files, retrieval sources, and scores.

- [ ] **Step 3: Add visual check**

Verify 16:9 desktop layout: no text overflow in knowledge search controls, task list, or result dialog.
