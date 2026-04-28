# WeChatAuto Stability Round 19 RAG Trust Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn RAG trust visibility into an operator decision surface that explains whether real sending is blocked and what to do next.

**Architecture:** Keep knowledge import/search and real-send behavior unchanged. Add a read-only diagnostics method/API that reuses the existing embedding trust metadata and real-send setting, then render the result on the Knowledge page as a trust gate with recommended actions. Stability acceptance checks should verify this contract before desktop runs.

**Tech Stack:** Python service/FastAPI/Pydantic, existing API contract fixtures, Next.js/React TypeScript frontend, P5 source acceptance, stability acceptance script.

---

### Task A: Backend Trust Diagnostics

- [x] Add a failing app service test for `get_knowledge_trust_diagnostics()`.
- [x] Return provider, trust status, trust reason, `real_send_enabled`, `blocked_for_real_send`, and recommended actions.
- [x] Add `GET /api/v1/knowledge/trust-diagnostics` with typed response schema and server tests.

### Task B: Contract And Acceptance

- [x] Add API contract assertions and fixture for trust diagnostics.
- [x] Extend `run_stability_acceptance.py` source and HTTP checks for diagnostics fields.

### Task C: Frontend Trust Gate

- [x] Add frontend API type/client method.
- [x] Render a Knowledge page trust gate with status and recommended actions.
- [x] Extend P5 and TypeScript contract checks.
- [x] Run frontend type/build verification.
