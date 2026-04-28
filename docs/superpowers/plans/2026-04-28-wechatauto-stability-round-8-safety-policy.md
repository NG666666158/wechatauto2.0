# WeChatAuto Stability Round 8: Safety Policy Engine

## Goal

Route high-risk user messages to manual review before the system generates or sends replies.

## Scope

- Replace the damaged safety keyword table with readable Chinese and English rule patterns.
- Treat prompt injection and sensitive information as `HIGH` risk.
- Treat refund, pricing, account, payment, invoice, contract, and complaint intent as `MEDIUM` risk requiring review.
- Apply input safety checks in the desktop suggestion path and runtime auto-reply path.
- Keep send-time output safety checks in place so risky manual replies are still blocked before real sending.

## Behavior

- Safe messages continue through the existing suggestion or send pipeline.
- High-risk suggestion requests return `pending_review` and create a `PENDING_REVIEW` ReplyJob.
- High-risk runtime messages create a `PENDING_REVIEW` ReplyJob and do not call the reply generator or pyweixin sender.
- Prompt injection and sensitive information are blocked from generation as well as sending.

## Validation

- `py -3 scripts\test_wechat_ai_safety_unit.py`
- `py -3 scripts\test_wechat_ai_unit.py`
- `py -3 scripts\test_wechat_ai_app_service_unit.py`
- `py -3 scripts\test_wechat_ai_server_unit.py`
- `py -3 scripts\test_wechat_ai_api_contract_unit.py`
- `npx tsc --noEmit` in `desktop_app/frontend`
- `node tests\p5-frontend-acceptance.mjs` in `desktop_app/frontend`
