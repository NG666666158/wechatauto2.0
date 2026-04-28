# WeChatAuto Stability Round 16 Parallel Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parallelize the next stability batch: unified desktop acceptance flow, runtime scanner/aggregation helper extraction, and safety policy import/export recovery.

**Architecture:** Keep real WeChat UI automation unchanged. Add orchestration scripts and small API/service surfaces around existing local state. Extract only pure runtime parsing/aggregation helpers that can be tested without desktop UI.

**Tech Stack:** Python stdlib scripts, FastAPI/Pydantic, local JSON/JSONL settings state, Next.js/React TypeScript frontend, existing unit and acceptance scripts.

---

### Track A: Unified Desktop Acceptance Flow

- [ ] Add a wrapper script that runs source-only stability checks, optional backend HTTP checks, and optional runtime smoke command.
- [ ] Output one JSON report and optional pretty output.
- [ ] Do not send messages automatically. Any real WeChat message injection must remain a manual instruction.
- [ ] Add unit tests for source-only mode and skipped runtime-smoke mode.

### Track B: Runtime Split Third Cut

- [ ] Extract pure scanner/aggregation helper logic from `wechat_ai/wechat_runtime.py`.
- [ ] Focus on message signature normalization, batch append/flush decisions, or sender/title parsing.
- [ ] Do not change pyweixin UI calls, foreground behavior, sender, confirmer, or SendCoordinator semantics.
- [ ] Add focused runtime unit tests.

### Track C: Safety Policy Import/Export Recovery

- [ ] Add service/API support to export current safety policy and import a validated policy payload.
- [ ] Preserve existing rule-group controls, reset defaults, and audit recording.
- [ ] Add Settings page controls for export/import using JSON text or download/upload-free copy surface.
- [ ] Add tests for validation, audit records, API contract, and frontend acceptance.

### Integration Checklist

- [ ] Review worker diffs for overlaps in `wechat_ai/app/service.py`, `desktop_app/frontend/lib/api.ts`, and frontend acceptance tests.
- [ ] Refresh API contract and fixtures after schema/endpoint changes.
- [ ] Run Python app service, server, API contract, runtime unit/wiring, stability acceptance tests.
- [ ] Run frontend `npx tsc --noEmit`, P5 acceptance, and `npm run build`.
- [ ] Remove Next build-generated config noise before commit.
- [ ] Commit and push `feature/stability-round-16-parallel-flow`.
