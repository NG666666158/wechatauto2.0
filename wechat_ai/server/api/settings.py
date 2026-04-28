from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any

from fastapi import APIRouter, Query, Request

from wechat_ai.server.api._events import publish_event
from wechat_ai.server.api._service import desktop_service
from wechat_ai.server.core import success_response
from wechat_ai.server.schemas import ApiResponse, SafetyPolicyAuditRecordData, SafetyPolicyConfigData, SettingsData
from wechat_ai.server.schemas.frontend import SafetyPolicyImportRequest, SettingsPatchRequest

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=ApiResponse[SettingsData])
def get_settings(request: Request) -> dict[str, object]:
    return success_response(_to_dict(desktop_service(request).get_settings()), trace_id=request.state.trace_id)


@router.patch("", response_model=ApiResponse[SettingsData])
def update_settings(patch: SettingsPatchRequest, request: Request) -> dict[str, object]:
    patch_data = patch.model_dump(exclude_none=True)
    data = _to_dict(
        desktop_service(request).update_settings(
            patch_data,
            operator="api",
            source="settings.patch",
        )
    )
    publish_event(request, "log.event", {"event_type": "settings.updated", "changed_keys": sorted(patch_data)})
    return success_response(data, trace_id=request.state.trace_id)


@router.get("/safety-policy/audit", response_model=ApiResponse[list[SafetyPolicyAuditRecordData]])
def list_safety_policy_audit(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
) -> dict[str, object]:
    return success_response(
        desktop_service(request).list_safety_policy_audit(limit=limit),
        trace_id=request.state.trace_id,
    )


@router.get("/safety-policy/export", response_model=ApiResponse[SafetyPolicyConfigData])
def export_safety_policy(request: Request) -> dict[str, object]:
    return success_response(
        desktop_service(request).export_safety_policy(),
        trace_id=request.state.trace_id,
    )


@router.post("/safety-policy/import", response_model=ApiResponse[SafetyPolicyConfigData])
def import_safety_policy(payload: SafetyPolicyImportRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).import_safety_policy(
        payload.safety_policy.model_dump(exclude_none=True),
        operator="api",
        source="settings.safety_policy.import",
    )
    publish_event(request, "log.event", {"event_type": "settings.safety_policy.imported"})
    return success_response(data, trace_id=request.state.trace_id)


@router.post("/safety-policy/restore-defaults", response_model=ApiResponse[SafetyPolicyConfigData])
def restore_default_safety_policy(request: Request) -> dict[str, object]:
    data = desktop_service(request).restore_default_safety_policy(
        operator="api",
        source="settings.safety_policy.restore",
    )
    publish_event(request, "log.event", {"event_type": "settings.safety_policy.restored"})
    return success_response(data, trace_id=request.state.trace_id)


def _to_dict(value: Any) -> dict[str, Any]:
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return dict(value)
    return {}
