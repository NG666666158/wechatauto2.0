# WeChatAuto Stability Round 7: Resolve And Restore

## Goal

Close the operator recovery loop for `SEND_UNCERTAIN` jobs without weakening the default safety posture.

## Scope

- Keep manual resolution conservative by default: resolving a send job does not resume auto-reply unless explicitly requested.
- Add an optional `unpause_conversation` flag to the send resolve API.
- Let `DesktopAppService.resolve_uncertain_send_job()` restore the matching conversation only after a successful manual confirmation.
- Add a Pending UI action for "confirm and restore" beside the existing "mark confirmed" and "mark failed" actions.
- Extend backend, API contract, and frontend acceptance tests.

## Validation

- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
- `npm run build` in `desktop_app/frontend`
