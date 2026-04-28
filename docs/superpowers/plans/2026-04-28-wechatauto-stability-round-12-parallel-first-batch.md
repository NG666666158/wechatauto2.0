# WeChatAuto Stability Round 12: Parallel First Batch

## Goal

Advance three mostly independent stability tracks in parallel while keeping runtime refactor work deferred until behavior is more settled.

## Parallel Tracks

### A. Safety Policy Config

- Move hard-coded safety rules into structured default configuration.
- Persist the policy through desktop settings.
- Keep current default behavior unchanged.
- Expose a minimal settings surface for enabling/disabling rule groups.

### B. SEND_UNCERTAIN Console

- Improve Pending page handling for uncertain sends.
- Add local filters for unresolved/error/evidence-backed items.
- Add recent error log visibility.
- Make screenshot evidence paths clear even before binary preview endpoints exist.

### C. RAG Evidence Visibility

- Preserve retriever metadata in knowledge search API responses.
- Show retrieval source, score breakdown, match terms, and document/source identifiers in the Knowledge page.
- Keep embedding provider/query behavior unchanged in this batch.

## Deferred

- Trusted embedding query construction.
- Screenshot FileResponse evidence API.
- Runtime module split.

## Integration Validation

- `py -3 scripts\test_wechat_ai_safety_unit.py`
- `py -3 scripts\test_wechat_ai_rag_retrieval_unit.py`
- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
- `npm run build` in `desktop_app/frontend`
