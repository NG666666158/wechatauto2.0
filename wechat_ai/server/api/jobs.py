from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Request
from pydantic import Field

from wechat_ai.server.core import ApiError, ErrorCode, success_response
from wechat_ai.server.schemas import ApiResponse, SendUncertainMetricsData
from wechat_ai.server.schemas.frontend import StrictRequestModel


router = APIRouter(prefix="/jobs", tags=["jobs"])


class ReplyApproveRequest(StrictRequestModel):
    draft_reply: str | None = Field(None, max_length=8000)
    reason: str | None = Field(None, max_length=1000)
    reviewed_by: str = Field("operator", max_length=200)
    send_after_approve: bool = False


class ReplyCancelRequest(StrictRequestModel):
    reason: str | None = Field(None, max_length=1000)
    reviewed_by: str = Field("operator", max_length=200)


class SendResolveRequest(StrictRequestModel):
    resolution: Literal["confirmed", "failed"]
    reason: str | None = Field(None, max_length=1000)
    reviewed_by: str = Field("operator", max_length=200)
    unpause_conversation: bool = False


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
    unresolved: bool | None = Query(default=None),
    conversation_id: str | None = Query(default=None, max_length=500),
    error_code: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(
        _service(request).list_send_jobs(
            status=status,
            limit=limit,
            unresolved=unresolved,
            conversation_id=conversation_id,
            error_code=error_code,
        ),
        trace_id=request.state.trace_id,
    )


@router.get("/send-uncertain")
def list_uncertain_send_jobs(
    request: Request,
    unresolved: bool | None = Query(default=True),
    conversation_id: str | None = Query(default=None, max_length=500),
    error_code: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(
        _service(request).list_uncertain_send_jobs(
            limit=limit,
            unresolved=unresolved,
            conversation_id=conversation_id,
            error_code=error_code,
        ),
        trace_id=request.state.trace_id,
    )


@router.get("/send-uncertain/metrics", response_model=ApiResponse[SendUncertainMetricsData])
def send_uncertain_metrics(request: Request) -> dict[str, object]:
    return success_response(
        _service(request).get_send_uncertain_metrics(),
        trace_id=request.state.trace_id,
    )


@router.get("/send/{send_job_id}/attempts")
def list_send_attempts(
    send_job_id: str,
    request: Request,
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, object]:
    return success_response(
        _service(request).list_send_attempts(send_job_id, limit=limit),
        trace_id=request.state.trace_id,
    )


@router.post("/reply/{reply_job_id}/approve")
def approve_reply_job(
    reply_job_id: str,
    request: Request,
    payload: ReplyApproveRequest | None = None,
) -> dict[str, object]:
    updated = _service(request).approve_reply_job(
        reply_job_id,
        draft_reply=payload.draft_reply if payload is not None else None,
        reason=payload.reason if payload is not None else None,
        reviewed_by=payload.reviewed_by if payload is not None else "operator",
        send_after_approve=payload.send_after_approve if payload is not None else False,
    )
    return success_response(updated, trace_id=request.state.trace_id)


@router.post("/reply/{reply_job_id}/cancel")
def cancel_reply_job(
    reply_job_id: str,
    request: Request,
    payload: ReplyCancelRequest | None = None,
) -> dict[str, object]:
    updated = _service(request).cancel_reply_job(
        reply_job_id,
        reason=payload.reason if payload is not None else None,
        reviewed_by=payload.reviewed_by if payload is not None else "operator",
    )
    return success_response(updated, trace_id=request.state.trace_id)


@router.post("/send/{send_job_id}/resolve")
def resolve_uncertain_send_job(
    send_job_id: str,
    payload: SendResolveRequest,
    request: Request,
) -> dict[str, object]:
    try:
        updated = _service(request).resolve_uncertain_send_job(
            send_job_id,
            resolution=payload.resolution,
            reason=payload.reason,
            reviewed_by=payload.reviewed_by,
            unpause_conversation=payload.unpause_conversation,
        )
    except ValueError as exc:
        raise ApiError(
            ErrorCode.REQUEST_INVALID,
            str(exc),
            detail={"send_job_id": send_job_id},
            status_code=400,
        ) from exc
    return success_response(updated, trace_id=request.state.trace_id)
