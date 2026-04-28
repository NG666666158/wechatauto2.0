# WeChatAuto Stability Round 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make send-attempt evidence visible through the API and desktop operator UI.

**Architecture:** `RuntimeStateStore` already records `send_attempts`; this round exposes that state through the jobs API and renders it beside each unresolved send job in the pending console.

**Tech Stack:** Python FastAPI backend, SQLite runtime state, Next.js desktop frontend, generated API contract snapshots.

---

## Scope

- [ ] Add service/API access for `send_attempts`.
- [ ] Add frontend API client type and method.
- [ ] Load attempts for each `SEND_UNCERTAIN` job on the pending page.
- [ ] Display attempt number, status, error fields, and screenshot paths.
- [ ] Refresh API contract snapshots.

## Validation Gate

- [ ] `py -3 scripts\test_wechat_ai_server_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_app_service_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_runtime_state_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- [ ] `npx tsc --noEmit` from `desktop_app/frontend`
- [ ] `node tests\p5-frontend-acceptance.mjs` from `desktop_app/frontend`
- [ ] `npm run build` from `desktop_app/frontend`
