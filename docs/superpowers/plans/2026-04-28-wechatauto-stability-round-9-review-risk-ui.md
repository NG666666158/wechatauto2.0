# WeChatAuto Stability Round 9: Review Risk UI

## Goal

Make manual reviewers understand why a ReplyJob was blocked before they approve, cancel, pause, or take over a conversation.

## Scope

- Persist ReplyJob `reason_codes` in SQLite and migrate existing local databases.
- Pass safety reason codes from desktop suggestion and runtime auto-reply safety checks into ReplyJobs.
- Expose `reason_codes` through the existing job list API shape.
- Render risk level and translated reason-code chips on Pending page ReplyJob cards.
- Keep the existing review queue and action buttons unchanged.

## Validation

- `py -3 scripts\test_wechat_ai_runtime_state_unit.py`
- `py -3 scripts\test_wechat_ai_safety_unit.py`
- `py -3 scripts\test_wechat_ai_unit.py`
- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
- `npm run build` in `desktop_app/frontend`
