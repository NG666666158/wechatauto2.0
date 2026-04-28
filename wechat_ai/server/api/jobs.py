from __future__ import annotations

from fastapi import APIRouter, Query, Request

from wechat_ai.server.core import success_response


router = APIRouter(prefix="/jobs", tags=["jobs"])


def _service(request: Request):
    return request.app.state.desktop_service


@router.get("/reply")
def list_reply_jobs(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(_service(request).list_reply_jobs(status=status, limit=limit), trace_id=request.state.trace_id)


@router.get("/send")
def list_send_jobs(
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(_service(request).list_send_jobs(status=status, limit=limit), trace_id=request.state.trace_id)


@router.get("/send-uncertain")
def list_uncertain_send_jobs(
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(_service(request).list_uncertain_send_jobs(limit=limit), trace_id=request.state.trace_id)
