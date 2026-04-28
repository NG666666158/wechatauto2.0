# WeChatAuto Stability Round 13 Parallel Second Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the second batch of stability work with safer configurable policy controls, a more actionable SEND_UNCERTAIN console, clearer RAG trust signals, and a small runtime split.

**Architecture:** Keep existing service and runtime entry points stable. Add narrow backend fields and frontend affordances around current state stores, and extract only low-risk pure helper logic from runtime-facing code.

**Tech Stack:** Python dataclasses/Pydantic/FastAPI, SQLite runtime state, Next.js/React TypeScript frontend, existing script-based unit and acceptance tests.

---

### Parallel Tracks

- [ ] **Track A: Safety Policy Controls**
  - Extend policy config validation so invalid regex rules are ignored safely and surfaced by tests.
  - Add rule-group enablement and reset-to-default support through settings.
  - Keep frontend controls bounded to known rule groups, not arbitrary regex editing.
  - Tests: `scripts/test_wechat_ai_safety_unit.py`, `scripts/test_wechat_ai_app_service_unit.py`, `scripts/test_wechat_ai_server_unit.py`, frontend `tsc` and P5 checks.

- [ ] **Track B: SEND_UNCERTAIN Console**
  - Add backend filters for unresolved send jobs by status, conversation, and error code where the existing API boundary supports it.
  - Preserve manual resolution semantics and add operator-facing notes/audit metadata when resolving.
  - Improve Pending page result/history visibility without adding any automatic resend path.
  - Tests: runtime state, app service, server jobs API, frontend contract/P5.

- [ ] **Track C: RAG Trust Visibility**
  - Carry trust signals from knowledge index/search into knowledge results and reply suggestion context.
  - Make fake/untrusted embedding status visible in frontend and tests.
  - Block or route real-send automation to manual review when knowledge is untrusted.
  - Tests: RAG retrieval, app service, server, frontend contract/P5.

- [ ] **Track D: Runtime Split First Cut**
  - Extract only pure helper logic that is already shared or duplicated, such as send preflight and knowledge evidence assembly.
  - Do not rewrite `wechat_ai/wechat_runtime.py` or change pyweixin interaction behavior.
  - Keep public imports stable through `wechat_ai.runtime`.
  - Tests: pipeline/reply runtime wiring, app service, runtime state.

### Integration Checklist

- [ ] Review worker diffs for overlapping files before editing.
- [ ] Refresh API contract and fixtures if schema or fixture-visible response shapes change.
- [ ] Run Python unit coverage for safety, RAG, runtime state, app service, server, API contract, and runtime wiring.
- [ ] Run frontend `npx tsc --noEmit`, P5 acceptance, and `npm run build`.
- [ ] Remove Next build-generated config noise before committing.
- [ ] Commit and push `feature/stability-round-13-parallel-second-batch`.
