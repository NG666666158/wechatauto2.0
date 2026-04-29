# Knowledge Base Construction Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining knowledge-base workflow gaps: confirmed AI normalization import, staged task progress, desktop embedding configuration, and retrieval acceptance reports.

**Architecture:** Keep the existing knowledge import/search pipeline stable. Add pure backend modules first, then connect them through service/API/frontend in a thin integration layer so each capability remains testable without network or WeChat runtime.

**Tech Stack:** Python FastAPI backend, local JSON stores, existing RAG modules under `wechat_ai/rag`, Next.js desktop frontend.

---

### Task 1: Confirmed AI Normalization Import

**Files:**
- Create: `wechat_ai/rag/normalized_writer.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/knowledge.py`
- Modify: `wechat_ai/server/schemas/frontend.py`
- Modify: `wechat_ai/server/schemas/desktop.py`
- Test: `scripts/test_wechat_ai_rag_normalized_writer_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [x] **Step 1: Convert preview to Markdown**

Create a pure converter that turns `AINormalizedPreview` into a Markdown document with source references and review warnings.

- [x] **Step 2: Add confirmation endpoint**

Add:

```http
POST /api/v1/knowledge/ai-normalize-confirm
```

This endpoint accepts preview content plus title/source, writes a generated Markdown document into the knowledge upload flow, rebuilds the index, and records a task.

- [x] **Step 3: Keep preview safe**

The existing preview endpoint must remain preview-only. Only the confirm endpoint can write a document.

### Task 2: Staged Knowledge Tasks

**Files:**
- Modify: `wechat_ai/app/knowledge_tasks.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/schemas/desktop.py`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Test: `scripts/test_wechat_ai_knowledge_tasks_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`

- [x] **Step 1: Add `stage` to task records**

Stages:

- `queued`
- `extracting`
- `chunking`
- `embedding`
- `indexing`
- `validating`
- `completed`
- `failed`

- [x] **Step 2: Record meaningful stages**

For now, synchronous flows should at least record queued/running stage transitions and final completed/failed state. Later background jobs can emit finer live progress.

- [x] **Step 3: Render stage in recent tasks**

Frontend recent task cards should show both user-facing status and current stage in Chinese.

### Task 3: Desktop Embedding Configuration

**Files:**
- Create: `wechat_ai/app/embedding_config.py`
- Modify: `wechat_ai/app/settings_store.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/schemas/desktop.py`
- Modify: `wechat_ai/server/schemas/frontend.py`
- Modify: `desktop_app/frontend/app/settings/page.tsx`
- Test: `scripts/test_wechat_ai_embedding_config_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `desktop_app/frontend/tests/api-client-contract.ts`

- [x] **Step 1: Add safe config model**

Represent provider/base_url/model/dimensions/timeout/api_key_set/api_key_preview without exposing the raw key in GET responses.

- [x] **Step 2: Add settings API surface**

Expose embedding config through settings, with PATCH support. Empty api_key must not erase existing key.

- [x] **Step 3: Add compact settings UI**

Put provider/model/base URL/dimensions/timeout and masked key input inside the most relevant settings tab, with a save toast.

### Task 4: Retrieval Acceptance Report

**Files:**
- Create: `wechat_ai/rag/acceptance_report.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/knowledge.py`
- Modify: `wechat_ai/server/schemas/frontend.py`
- Modify: `wechat_ai/server/schemas/desktop.py`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Test: `scripts/test_wechat_ai_rag_acceptance_report_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [x] **Step 1: Build report core**

Input a list of questions and per-question retrieved chunks; output hit/miss/needs_review items with scores and trust signals.

- [x] **Step 2: Add report endpoint**

Add:

```http
POST /api/v1/knowledge/acceptance-report
```

The service should call current search for each question, then build and store a compact report task.

- [x] **Step 3: Add frontend dialog**

Keep the page compact: user enters questions, clicks report, sees a scrollable dialog with verdicts and source evidence.

### Verification

Run:

```powershell
python scripts\test_wechat_ai_knowledge_tasks_unit.py
python scripts\test_wechat_ai_rag_normalized_writer_unit.py
python scripts\test_wechat_ai_embedding_config_unit.py
python scripts\test_wechat_ai_rag_acceptance_report_unit.py
python scripts\test_wechat_ai_app_service_unit.py
python scripts\test_wechat_ai_server_unit.py
python scripts\test_wechat_ai_api_contract_unit.py
npx tsc --noEmit --pretty false
node tests\p5-frontend-acceptance.mjs
```
