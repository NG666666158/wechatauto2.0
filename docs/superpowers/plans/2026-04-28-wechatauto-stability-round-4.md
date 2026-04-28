# WeChatAuto Stability Round 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the real-send path easier to audit and harder to repeat accidentally by adding confirmation evidence, unresolved-send blocking, and clearer operator UI.

**Architecture:** Keep `RuntimeStateStore` as the send-job source of truth. `SendCoordinator` records structured confirmation evidence, service/runtime prechecks block unresolved uncertain sends, and the desktop frontend displays the resulting evidence without directly operating WeChat UI.

**Tech Stack:** Python runtime/backend, SQLite runtime state, pyweixin visual probe, Next.js desktop frontend.

---

## Track A: Send Evidence

**Files:**
- Modify: `wechat_ai/app/wechat_window_probe.py`
- Modify: `wechat_ai/runtime/send_coordinator.py`
- Test: `scripts/test_wechat_window_probe_unit.py`
- Test: `scripts/test_wechat_ai_runtime_state_unit.py`

- [ ] Return structured confirmation results from the visual confirmer.
- [ ] Preserve compatibility with bool confirmers.
- [ ] Persist screenshot paths and evidence in send jobs and attempts.
- [ ] Cover confirmed and uncertain send flows with focused tests.

## Track B: Conversation-Level Blocking

**Files:**
- Modify: `wechat_ai/storage/runtime_state.py`
- Modify: `wechat_ai/app/service.py`
- Modify: `wechat_ai/wechat_runtime.py`
- Test: `scripts/test_wechat_ai_runtime_state_unit.py`
- Test: `scripts/test_wechat_ai_app_service_unit.py`
- Test: `scripts/test_wechat_ai_unit.py`

- [ ] Add runtime-state query for unresolved `SEND_UNCERTAIN` by conversation.
- [ ] Block manual/desktop sends when unresolved uncertain sends exist.
- [ ] Block runtime auto sends for the same condition before pyweixin send.
- [ ] Reuse instance-level UI locks where low-risk.

## Track C: Operator UI Evidence

**Files:**
- Modify: `desktop_app/frontend/app/page.tsx`
- Modify: `desktop_app/frontend/app/pending/page.tsx`
- Modify: `desktop_app/frontend/lib/api.ts`
- Modify: `desktop_app/frontend/tests/api-client-contract.ts`
- Modify: `desktop_app/frontend/tests/p5-frontend-acceptance.mjs`

- [ ] Display confirmation reason, matched text, visible messages, and screenshot paths when present.
- [ ] Add a compact home-page count for unresolved uncertain sends.
- [ ] Keep manual resolve actions available from the pending page.
- [ ] Verify TypeScript and frontend static acceptance.

## Validation Gate

- [ ] `py -3 scripts\test_wechat_window_probe_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_runtime_state_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_app_service_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_unit.py`
- [ ] `py -3 scripts\test_wechat_ai_server_unit.py`
- [ ] `npx tsc --noEmit` from `desktop_app/frontend`
- [ ] `node tests\p5-frontend-acceptance.mjs` from `desktop_app/frontend`
- [ ] `npm run build` from `desktop_app/frontend`
