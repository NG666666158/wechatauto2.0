# WeChatAuto Stability Round 10: Approve And Send

## Goal

Close the manual review loop so an operator can approve a ReplyJob and optionally send the approved draft through the same coordinated send path.

## Scope

- Add `send_after_approve` to the ReplyJob approve API request.
- Keep normal approval unchanged: it only marks the ReplyJob `APPROVED`.
- When `send_after_approve` is true, send the approved draft with the existing `reply_job_id` through `SendCoordinator`.
- Preserve send coordination behavior: UI lock, unresolved `SEND_UNCERTAIN` guard, send attempts, and send confirmation.
- Treat manual approval as the safety override for high-risk business content, while keeping conversation-control and empty-message checks.
- Add a Pending page “approve and send” action.

## Validation

- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
- `npm run build` in `desktop_app/frontend`
