# WeChatAuto Stability Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the manual handling loop around review jobs, uncertain sends, and RAG trust so the project can move from passive observation to controlled operator workflows.

**Architecture:** Keep SQLite runtime state as the source of truth for job status, expose small mutation APIs through the desktop backend, and let the frontend call those APIs without directly touching WeChat UI. RAG trust remains a pre-send policy concern, backed by explicit index metadata instead of only provider-name guesses.

**Tech Stack:** Python FastAPI backend, SQLite runtime state, Next.js desktop frontend, existing PowerShell/dev-start flow.

---

## Execution Order

### Track A: Backend Job Actions

**Files:**
- Modify: `wechat_ai/storage/runtime_state.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/jobs.py`
- Test: `scripts/test_wechat_ai_runtime_state_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [ ] Add `get_reply_job`, `mark_reply_job`, and `resolve_uncertain_send_job` to `RuntimeStateStore`.
- [ ] Add service methods `approve_reply_job`, `cancel_reply_job`, and `resolve_send_job`.
- [ ] Add FastAPI mutations:
  - `POST /api/v1/jobs/reply/{reply_job_id}/approve`
  - `POST /api/v1/jobs/reply/{reply_job_id}/cancel`
  - `POST /api/v1/jobs/send/{send_job_id}/resolve`
- [ ] Test status transitions and ensure `SEND_UNCERTAIN` is never resent automatically.

### Track B: Frontend Pending Console Actions

**Files:**
- Modify: `desktop_app/frontend/app/pending/page.tsx`
- Modify: `desktop_app/frontend/lib/api.ts`
- Modify: `desktop_app/frontend/tests/api-client-contract.ts`
- Modify: `desktop_app/frontend/tests/p5-frontend-acceptance.mjs`

- [ ] Add API client methods for approve, cancel, and resolve.
- [ ] Add compact action buttons to ReplyJob cards.
- [ ] Add compact action buttons to SEND_UNCERTAIN SendJob cards.
- [ ] Refresh queues after mutation and surface errors through the existing page feedback.
- [ ] Verify with TypeScript and static frontend acceptance.

### Track C: RAG Trust Metadata

**Files:**
- Modify: `wechat_ai/rag/embeddings.py`
- Modify: `wechat_ai/rag/ingest.py`
- Modify: `wechat_ai/rag/retriever.py`
- Modify: `wechat_ai/app/knowledge_importer.py`
- Test: `scripts/test_wechat_ai_rag_retrieval_unit.py`
- Test: `scripts/test_wechat_ai_knowledge_importer_unit.py`

- [ ] Make index trust explicit with `embedding_provider` and `embedding_trusted`.
- [ ] Keep FakeEmbeddings default untrusted.
- [ ] Treat old indexes without explicit trust as untrusted.
- [ ] Expose trust metadata through knowledge status if the current status shape allows it safely.
- [ ] Verify helpers with focused RAG trust tests.

## Validation Gate

- [ ] `py -3 scripts\test_wechat_ai_runtime_state_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_app_service_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_server_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_rag_retrieval_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_knowledge_importer_unit.py`
- [ ] `npx tsc --noEmit` from `desktop_app/frontend`
- [ ] `node tests\p5-frontend-acceptance.mjs` from `desktop_app/frontend`
- [ ] `npm run build` from `desktop_app/frontend`, followed by cleanup of Next generated config pointer noise.
