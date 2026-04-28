# Stability Acceptance Gate

This safe preflight gate verifies the stability work added around runtime preflight, SEND_UNCERTAIN recovery, safety policy audit, RAG trust review, and trusted RAG rebuild readiness.

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

The script is safe for preflight use: it does not call send APIs and does not operate the WeChat UI. Most checks are GET requests; the trusted RAG rebuild probe may call `POST /api/v1/knowledge/trusted-rebuild`, which only rebuilds the local knowledge index when a trusted embedding provider is configured.

## Unified Desktop Acceptance Flow

Run the safe default flow when you want one report that includes the source-only gate and skips optional live checks:

```powershell
py -3 scripts\run_desktop_acceptance_flow.py --skip-http --skip-runtime-smoke --format pretty
```

Run the backend HTTP gate as part of the same report after the local backend is up:

```powershell
py -3 scripts\run_desktop_acceptance_flow.py --base-url http://127.0.0.1:8765/api/v1 --skip-runtime-smoke --format pretty
```

The unified flow outputs one JSON report with each step's command, exit code, accepted/skipped state, and stdout/stderr summaries. Runtime smoke is disabled by default. To run it, pass `--run-runtime-smoke`; this calls `scripts\runtime_web_smoke_1min.ps1`, starts and stops the runtime, and relies on the existing prompt for manual message injection. The flow does not automatically send WeChat messages.

## Covered Contracts

- Runtime send preflight helper exists and keeps `SEND_UNCERTAIN` blocking visible.
- SEND_UNCERTAIN metrics expose unresolved count, recent 24h count, top error codes, and top conversations.
- Safety policy audit records rule group changes and reset events.
- RAG fake/untrusted knowledge routing keeps replies in manual review.
- RAG trust diagnostics expose real-send blocking, trusted rebuild availability, provider, and recommended actions.
- Trusted RAG rebuild is available through `POST /api/v1/knowledge/trusted-rebuild` and remains independent from WeChat message sending.
- Home page risk overview remains wired to the frontend API client.

## Round 20 Status

As of 2026-04-28, the stability gate includes the Round 20 trusted RAG rebuild flow:

- `GET /api/v1/knowledge/trust-diagnostics`
- `POST /api/v1/knowledge/trusted-rebuild`
- `GET /api/v1/debug/knowledge-acceptance/history`

Use the source-only flow before starting services, and the backend HTTP flow after `scripts/dev_start.ps1` reports both frontend and backend ready.
