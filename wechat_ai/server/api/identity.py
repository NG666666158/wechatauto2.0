from __future__ import annotations

from fastapi import APIRouter, Request

from wechat_ai.server.api._service import desktop_service
from wechat_ai.server.core import ApiError, ErrorCode, success_response
from wechat_ai.server.schemas import ApiResponse, IdentityCandidateData, IdentityDraftData, SelfIdentityData
from wechat_ai.server.schemas.frontend import SelfIdentityGenerateRequest, SelfIdentityPatchRequest

router = APIRouter(prefix="/identity", tags=["identity"])


@router.get("/drafts", response_model=ApiResponse[list[IdentityDraftData]])
def list_identity_drafts(request: Request) -> dict[str, object]:
    return success_response(desktop_service(request).list_identity_drafts(), trace_id=request.state.trace_id)


@router.get("/candidates", response_model=ApiResponse[list[IdentityCandidateData]])
def list_identity_candidates(request: Request) -> dict[str, object]:
    return success_response(desktop_service(request).list_identity_candidates(), trace_id=request.state.trace_id)


@router.get("/self/global", response_model=ApiResponse[SelfIdentityData])
def get_global_self_identity(request: Request) -> dict[str, object]:
    return success_response(desktop_service(request).get_global_self_identity(), trace_id=request.state.trace_id)


@router.patch("/self/global", response_model=ApiResponse[SelfIdentityData])
def update_global_self_identity(patch: SelfIdentityPatchRequest, request: Request) -> dict[str, object]:
    return success_response(
        desktop_service(request).update_global_self_identity(patch.model_dump(exclude_none=True)),
        trace_id=request.state.trace_id,
    )


@router.post("/self/global/generate", response_model=ApiResponse[SelfIdentityData])
def generate_global_self_identity(payload: SelfIdentityGenerateRequest, request: Request) -> dict[str, object]:
    try:
        data = desktop_service(request).generate_global_self_identity(payload.display_name)
    except ValueError as exc:
        message = str(exc)
        code = ErrorCode.CONFIG_INVALID if "MINIMAX_API_KEY" in message else ErrorCode.MODEL_API_FAILED
        raise ApiError(code, message, status_code=400) from exc
    except Exception as exc:
        raise ApiError(ErrorCode.MODEL_API_FAILED, "自我身份 AI 生成失败，请检查大模型配置或稍后重试。", status_code=502) from exc
    return success_response(data, trace_id=request.state.trace_id)
