from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Query, Request, UploadFile

from wechat_ai.server.api._events import publish_event
from wechat_ai.server.api._service import desktop_service
from wechat_ai.server.core import success_response
from wechat_ai.server.schemas import (
    ApiResponse,
    KnowledgeAcceptanceReportData,
    KnowledgeImportResultData,
    KnowledgeNormalizeConfirmResultData,
    KnowledgeNormalizePreviewData,
    KnowledgeSearchResultData,
    KnowledgeStatusData,
    KnowledgeTaskData,
    KnowledgeTrustDiagnosticsData,
    KnowledgeTrustedRebuildResultData,
    WebKnowledgeBuildResultData,
)
from wechat_ai.server.schemas.frontend import (
    KnowledgeAcceptanceReportRequest,
    KnowledgeImportRequest,
    KnowledgeNormalizeConfirmRequest,
    KnowledgeNormalizePreviewRequest,
    KnowledgeTrustedRebuildRequest,
    WebKnowledgeBuildRequest,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


def _safe_upload_name(filename: str) -> str:
    name = Path(filename or "knowledge-file").name.strip() or "knowledge-file"
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)


@router.get("/status", response_model=ApiResponse[KnowledgeStatusData])
def knowledge_status(request: Request) -> dict[str, object]:
    return success_response(desktop_service(request).get_knowledge_status(), trace_id=request.state.trace_id)


@router.get("/trust-diagnostics", response_model=ApiResponse[KnowledgeTrustDiagnosticsData])
def knowledge_trust_diagnostics(request: Request) -> dict[str, object]:
    return success_response(desktop_service(request).get_knowledge_trust_diagnostics(), trace_id=request.state.trace_id)


@router.post("/trusted-rebuild", response_model=ApiResponse[KnowledgeTrustedRebuildResultData])
def rebuild_knowledge_with_trusted_embeddings(
    payload: KnowledgeTrustedRebuildRequest,
    request: Request,
) -> dict[str, object]:
    data = desktop_service(request).rebuild_knowledge_with_trusted_embeddings(
        acceptance_query=payload.acceptance_query,
    )
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": data.get("status", "rebuilt") if isinstance(data, dict) else "rebuilt",
            "trusted_rebuild": True,
            "accepted": bool(data.get("accepted", False)) if isinstance(data, dict) else False,
        },
    )
    return success_response(data, trace_id=request.state.trace_id)


@router.get("/search", response_model=ApiResponse[list[KnowledgeSearchResultData]])
def search_knowledge(request: Request, q: str = Query(...), limit: int = Query(3, ge=1, le=20)) -> dict[str, object]:
    return success_response(desktop_service(request).search_knowledge(q, limit=limit), trace_id=request.state.trace_id)


@router.get("/tasks", response_model=ApiResponse[list[KnowledgeTaskData]])
def list_knowledge_tasks(request: Request, limit: int = Query(20, ge=1, le=100)) -> dict[str, object]:
    return success_response(desktop_service(request).list_knowledge_tasks(limit=limit), trace_id=request.state.trace_id)


@router.post("/ai-normalize-preview", response_model=ApiResponse[KnowledgeNormalizePreviewData])
def ai_normalize_preview(payload: KnowledgeNormalizePreviewRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).build_ai_knowledge_normalize_preview(
        text=payload.text,
        title=payload.title,
        source=payload.source,
    )
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": "ai_normalize_preview",
            "title": payload.title,
            "source": payload.source,
        },
    )
    return success_response(data, trace_id=request.state.trace_id)


@router.post("/ai-normalize-confirm", response_model=ApiResponse[KnowledgeNormalizeConfirmResultData])
def ai_normalize_confirm(payload: KnowledgeNormalizeConfirmRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).confirm_ai_knowledge_normalize_preview(
        title=payload.title,
        source=payload.source,
        preview=payload.preview.model_dump(mode="json"),
    )
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": "ai_normalize_confirmed",
            "title": payload.title,
            "source": payload.source,
        },
    )
    return success_response(data, trace_id=request.state.trace_id)


@router.post("/acceptance-report", response_model=ApiResponse[KnowledgeAcceptanceReportData])
def acceptance_report(payload: KnowledgeAcceptanceReportRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).build_knowledge_acceptance_report(
        payload.questions,
        limit=payload.limit,
        min_top_score=payload.min_top_score,
    )
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": "acceptance_report",
            "question_count": len(payload.questions),
            "needs_review": bool(data.get("needs_review", False)) if isinstance(data, dict) else False,
        },
    )
    return success_response(data, trace_id=request.state.trace_id)


@router.post("/import", response_model=ApiResponse[KnowledgeImportResultData])
def import_knowledge(payload: KnowledgeImportRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).import_knowledge_files(payload.file_paths)
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": "imported",
            "file_count": len(payload.file_paths),
            "index_rebuilt": data.get("index_rebuilt", False) if isinstance(data, dict) else False,
        },
    )
    return success_response(
        data,
        trace_id=request.state.trace_id,
    )


@router.post("/upload", response_model=ApiResponse[KnowledgeImportResultData])
async def upload_knowledge(request: Request, files: list[UploadFile] = File(...)) -> dict[str, object]:
    service = desktop_service(request)
    upload_dir = service.data_root / "knowledge" / "browser_uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: list[str] = []
    for file in files:
        safe_name = _safe_upload_name(file.filename or "knowledge-file")
        target = upload_dir / f"{uuid.uuid4().hex}_{safe_name}"
        target.write_bytes(await file.read())
        saved_paths.append(str(target))
    data = service.import_knowledge_files(saved_paths)
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": "uploaded",
            "file_count": len(saved_paths),
            "index_rebuilt": data.get("index_rebuilt", False) if isinstance(data, dict) else False,
        },
    )
    return success_response(data, trace_id=request.state.trace_id)


@router.post("/web-build", response_model=ApiResponse[WebKnowledgeBuildResultData])
def build_web_knowledge(payload: WebKnowledgeBuildRequest, request: Request) -> dict[str, object]:
    data = desktop_service(request).build_web_knowledge_from_documents(
        payload.file_paths,
        search_limit=payload.search_limit,
    )
    publish_event(
        request,
        "knowledge.progress",
        {
            "status": data.get("status", "built") if isinstance(data, dict) else "built",
            "file_count": len(payload.file_paths),
            "search_limit": payload.search_limit,
        },
    )
    return success_response(
        data,
        trace_id=request.state.trace_id,
    )
