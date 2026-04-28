# WeChatAuto Stability Round 17 RAG Acceptance History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RAG trust acceptance auditable by persisting recent knowledge acceptance snapshots and exposing them through the local debug API.

**Architecture:** Keep the current knowledge import/search path unchanged. Extend `DesktopAppService.build_knowledge_acceptance_snapshot()` to append a small JSONL record under the existing data root, then add a read-only API to list recent records. The record stores query, imported files, retrieved chunk ids, trust status, and a timestamp, but not full chunk text.

**Tech Stack:** Python stdlib JSONL files, FastAPI/Pydantic schemas, existing API contract fixture scripts, script-based unit tests.

---

### Task A: Service-Level History

- [x] Add failing app-service test proving a knowledge acceptance snapshot writes one compact history record.
- [x] Add `list_knowledge_acceptance_history(limit=...)` to return newest records first with a bounded limit.
- [x] Preserve the existing snapshot response shape.

### Task B: Debug API And Schemas

- [x] Add `KnowledgeAcceptanceHistoryRecordData` schema.
- [x] Add `GET /api/v1/debug/knowledge-acceptance/history`.
- [x] Add server tests for the new endpoint and limit validation.

### Task C: Contract And Verification

- [x] Refresh API contract snapshots and fixtures.
- [x] Add API contract assertions for the history endpoint.
- [x] Run app service, server, API contract, stability acceptance, and diff checks.
