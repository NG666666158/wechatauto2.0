# WeChatAuto Stability Round 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make operator decisions and knowledge trust auditable: review actions keep reasons and reviewer metadata, trusted embedding configuration becomes explicit, and the desktop UI shows those signals.

**Architecture:** Runtime SQLite remains the job audit source. RAG trust is derived from configured embedding provider metadata during index build. The frontend passes operator review metadata and displays both review state and embedding trust state.

**Tech Stack:** Python FastAPI backend, SQLite migrations, deterministic local embeddings, Next.js desktop frontend.

---

## Track A: Manual Review Audit

**Files:**
- Modify: `wechat_ai/storage/runtime_state.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/server/api/jobs.py`
- Test: `scripts/test_wechat_ai_runtime_state_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_server_unit.py`

- [ ] Add `review_reason`, `reviewed_by`, and `reviewed_at` columns to `reply_jobs`.
- [ ] Persist approve/cancel review metadata.
- [ ] Include operator metadata in manual send resolution evidence.
- [ ] Cover migration and API bodies with tests.

## Track B: Embedding Provider Configuration

**Files:**
- Modify: `wechat_ai/rag/embeddings.py`
- Modify: `wechat_ai/rag/ingest.py`
- Modify: `wechat_ai/app/knowledge_importer.py`
- Modify: `wechat_ai/config.py`
- Test: `scripts/test_wechat_ai_rag_retrieval_unit.py`
- Test: `scripts/test_wechat_ai_knowledge_importer_unit.py`
- Test: `scripts/test_wechat_ai_profile_config_unit.py`

- [ ] Add `WECHATAUTO_EMBEDDING_PROVIDER`.
- [ ] Keep `fake` as default and untrusted.
- [ ] Add deterministic `trusted_local` provider with trusted metadata.
- [ ] Build index trust metadata from provider info.

## Track C: Frontend Audit Display

**Files:**
- Modify: `desktop_app/frontend/app/pending/page.tsx`
- Modify: `desktop_app/frontend/app/knowledge/page.tsx`
- Modify: `desktop_app/frontend/lib/api.ts`
- Modify: `desktop_app/frontend/tests/api-client-contract.ts`
- Modify: `desktop_app/frontend/tests/p5-frontend-acceptance.mjs`

- [ ] Send operator metadata in approve/cancel/resolve actions.
- [ ] Display review metadata when present.
- [ ] Display embedding provider and trusted/untrusted status.
- [ ] Verify TypeScript and frontend acceptance.

## Validation Gate

- [ ] `py -3 scripts\test_wechat_ai_runtime_state_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_app_service_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_server_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_rag_retrieval_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_knowledge_importer_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_profile_config_unit.py`
- [ ] `npx tsc --noEmit` from `desktop_app/frontend`
- [ ] `node tests\p5-frontend-acceptance.mjs` from `desktop_app/frontend`
- [ ] `npm run build` from `desktop_app/frontend`
