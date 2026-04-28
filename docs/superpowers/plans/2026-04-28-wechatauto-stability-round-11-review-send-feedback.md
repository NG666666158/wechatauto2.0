# WeChatAuto Stability Round 11: Review Send Feedback

## Goal

Make the manual review console show the result of "approve and send" without forcing the operator to infer it from a separate queue.

## Scope

- Render approve-send feedback on ReplyJob cards when the approve API response includes `send_status` or `send_result`.
- Show the send status, linked `send_job_id`, confirmation flag, reason code, reason, and sent text when available.
- Keep the SendJob exception queue as the detailed handling surface for `SEND_UNCERTAIN`.
- Add frontend type and P5 acceptance coverage so the feedback panel stays visible in future changes.

## Validation

- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npm run build` in `desktop_app/frontend`
