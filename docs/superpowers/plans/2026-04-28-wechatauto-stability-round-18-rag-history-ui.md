# WeChatAuto Stability Round 18 RAG History UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface RAG acceptance history in the desktop frontend so operators can see recent trust checks and retrieved chunk ids without calling the debug API manually.

**Architecture:** Keep the backend API from Round 17 unchanged. Add a typed frontend API client method, load recent history on the Knowledge page, and render a compact operator panel beside search evidence. Use existing P5 source-level acceptance to guard the UI contract.

**Tech Stack:** Next.js/React TypeScript frontend, existing local API client, existing P5 acceptance script, TypeScript type checking, Next production build.

---

### Task A: Frontend API Contract

- [x] Add a `KnowledgeAcceptanceHistoryRecord` type.
- [x] Add `apiClient.getKnowledgeAcceptanceHistory(limit)`.
- [x] Extend frontend API contract tests to compile against the new type and client call.

### Task B: Knowledge Page Visualization

- [x] Load recent history on page mount and after search/import/web-build actions.
- [x] Render a compact "Knowledge Acceptance History" panel with timestamp, query, trust status, provider, imported files, and retrieved chunk ids.
- [x] Keep the panel read-only and avoid displaying full retrieved chunk text.

### Task C: Verification

- [x] Extend P5 acceptance checks for the API client and Knowledge page panel.
- [x] Run `node tests\p5-frontend-acceptance.mjs`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
