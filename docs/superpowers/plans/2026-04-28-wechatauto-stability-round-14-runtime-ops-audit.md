# WeChatAuto Stability Round 14 Runtime Ops Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Continue stability hardening by deepening runtime decomposition, adding SEND_UNCERTAIN operational visibility, auditing safety policy changes, and routing untrusted RAG suggestions to manual review.

**Architecture:** Preserve current public APIs and real WeChat UI behavior. Split only pure runtime decision logic, add narrow dashboard/service fields for operational metrics, and store local audit records in existing local settings/runtime state patterns.

**Tech Stack:** Python dataclasses/Pydantic/FastAPI, SQLite runtime state, local JSON settings, Next.js/React TypeScript frontend, existing script-based verification.

---

### Track A: Runtime Split Second Cut

- [ ] Extract a pure send preflight helper from duplicated service/runtime checks.
- [ ] Keep `wechat_ai/wechat_runtime.py` public behavior stable; do not change pyweixin UI operations.
- [ ] Route existing app service and runtime code through the helper where low risk.
- [ ] Add focused tests for helper behavior and existing runtime wiring.

### Track B: SEND_UNCERTAIN Metrics And Home Risk Overview

- [ ] Add backend method/API for SEND_UNCERTAIN metrics: total unresolved, last 24h count, top error codes, top conversations.
- [ ] Add Home page risk overview using existing dashboard/runtime data patterns.
- [ ] Keep Pending page resolve semantics unchanged and never add auto-resend behavior.
- [ ] Add server, app service, frontend contract, and P5 coverage.

### Track C: Safety Policy Audit Trail

- [ ] Record safety policy changes with timestamp, action, rule group diff, and operator/source.
- [ ] Expose recent safety policy audit records through settings/service API or settings response if simpler.
- [ ] Show audit history in Settings page near safety controls.
- [ ] Add app service, settings store/server, frontend contract, and P5 coverage.

### Track D: RAG Untrusted Suggestions Manual Review

- [ ] When knowledge trust is fake/untrusted and knowledge context is used, reply suggestion should enter manual review instead of looking ready for automation.
- [ ] Preserve empty-input and high-risk safety behavior.
- [ ] Add reason code and trust context to created ReplyJob.
- [ ] Add app service/server/frontend tests where response shape changes.

### Integration Checklist

- [ ] Review worker changes for overlapping `wechat_ai/app/service.py`, frontend `lib/api.ts`, and P5 tests.
- [ ] Refresh OpenAPI and fixtures after schema/response changes.
- [ ] Run Python safety, RAG, runtime state, app service, server, API contract, and runtime wiring tests.
- [ ] Run frontend `npx tsc --noEmit`, P5 acceptance, and `npm run build`.
- [ ] Remove Next build config noise before commit.
- [ ] Commit and push `feature/stability-round-14-runtime-ops-audit`.
