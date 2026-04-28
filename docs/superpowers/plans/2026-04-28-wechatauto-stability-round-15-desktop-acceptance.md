# WeChatAuto Stability Round 15 Desktop Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only stability acceptance entrypoint that verifies the current safety, SEND_UNCERTAIN, RAG trust, and runtime preflight hardening can be checked before real desktop runs.

**Architecture:** Keep the acceptance script safe by default. It performs local source contract checks without sending messages, and optionally probes backend HTTP APIs when the local service is already running.

**Tech Stack:** Python stdlib CLI, existing FastAPI response shapes, existing unit test runner.

---

### Task 1: Read-Only Stability Acceptance Script

- [x] Create `scripts/run_stability_acceptance.py`.
- [x] Check source contracts for runtime preflight, SEND_UNCERTAIN metrics, safety audit, RAG manual review, and home risk overview.
- [x] Add optional HTTP checks for dashboard summary, SEND_UNCERTAIN metrics, safety policy audit, and knowledge acceptance APIs.
- [x] Mark the script as read-only and message-safe in the JSON report.

### Task 2: Unit Coverage

- [x] Create `scripts/test_stability_acceptance_unit.py`.
- [x] Verify source-only mode passes.
- [x] Verify HTTP mode detects required response fields against a local fake server.
- [x] Verify the CLI emits valid JSON.

### Verification

- [ ] `py -3 scripts\test_stability_acceptance_unit.py`
- [ ] Existing stability unit smoke checks before commit.
