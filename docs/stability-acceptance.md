# Stability Acceptance Gate

This read-only gate verifies the stability work added around runtime preflight, SEND_UNCERTAIN recovery, safety policy audit, and RAG trust review.

## Source-Only Check

Run this when the backend is not running:

```powershell
py -3 scripts\run_stability_acceptance.py --skip-http --format pretty
```

## Backend HTTP Check

Run this after starting the local backend:

```powershell
py -3 scripts\run_stability_acceptance.py --base-url http://127.0.0.1:8765/api/v1 --format pretty
```

The script is safe for preflight use: it performs GET requests only, does not call send APIs, and does not operate the WeChat UI.

## Covered Contracts

- Runtime send preflight helper exists and keeps `SEND_UNCERTAIN` blocking visible.
- SEND_UNCERTAIN metrics expose unresolved count, recent 24h count, top error codes, and top conversations.
- Safety policy audit records rule group changes and reset events.
- RAG fake/untrusted knowledge routing keeps replies in manual review.
- Home page risk overview remains wired to the frontend API client.
