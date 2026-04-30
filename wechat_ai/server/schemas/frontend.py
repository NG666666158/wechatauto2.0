from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class KnowledgeImportRequest(StrictRequestModel):
    file_paths: list[str] = Field(..., min_length=1, max_length=100)

    @field_validator("file_paths", mode="after")
    @classmethod
    def reject_blank_file_paths(cls, value: list[str]) -> list[str]:
        return _clean_nonblank_strings(value, field_name="file_paths")


class WebKnowledgeBuildRequest(StrictRequestModel):
    file_paths: list[str] = Field(..., min_length=1, max_length=20)
    search_limit: int = Field(5, ge=1, le=20)

    @field_validator("file_paths", mode="after")
    @classmethod
    def reject_blank_file_paths(cls, value: list[str]) -> list[str]:
        return _clean_nonblank_strings(value, field_name="file_paths")


class KnowledgeTrustedRebuildRequest(StrictRequestModel):
    acceptance_query: str = Field("", max_length=500)


class KnowledgeNormalizePreviewRequest(StrictRequestModel):
    text: str = Field(..., min_length=1, max_length=20000)
    title: str = Field("", max_length=200)
    source: str = Field("", max_length=500)


class KnowledgeNormalizeFaqItemRequest(StrictRequestModel):
    question: str = Field("", max_length=1000)
    answer: str = Field("", max_length=4000)
    confidence: str = Field("", max_length=32)


class KnowledgeNormalizePreviewPayloadRequest(StrictRequestModel):
    faq_items: list[KnowledgeNormalizeFaqItemRequest] = Field(default_factory=list, max_length=100)
    allowed_claims: list[str] = Field(default_factory=list, max_length=200)
    forbidden_claims: list[str] = Field(default_factory=list, max_length=200)
    handoff_rules: list[str] = Field(default_factory=list, max_length=200)
    source_excerpt: str = Field("", max_length=8000)
    warnings: list[str] = Field(default_factory=list, max_length=100)


class KnowledgeNormalizeConfirmRequest(StrictRequestModel):
    title: str = Field("", max_length=200)
    source: str = Field("", max_length=500)
    preview: KnowledgeNormalizePreviewPayloadRequest


class KnowledgeAcceptanceReportRequest(StrictRequestModel):
    questions: list[str] = Field(..., min_length=1, max_length=50)
    limit: int = Field(3, ge=1, le=20)
    min_top_score: float = Field(0.7, ge=0, le=1)


class ReplySuggestionRequest(StrictRequestModel):
    message_text: str = Field("", max_length=8000)


class SendReplyRequest(StrictRequestModel):
    text: str = Field("", max_length=8000)


class PrivacyPolicyPatchRequest(StrictRequestModel):
    redact_sensitive_logs: bool | None = None
    log_retention_days: int | None = Field(None, ge=1, le=365)
    memory_retention_days: int | None = Field(None, ge=1, le=3650)
    max_recent_log_events: int | None = Field(None, ge=1, le=5000)


class WorkHoursPatchRequest(StrictRequestModel):
    enabled: bool | None = None
    start_day: str | None = Field(None, max_length=16)
    end_day: str | None = Field(None, max_length=16)
    start: str | None = Field(None, min_length=4, max_length=5)
    end: str | None = Field(None, min_length=4, max_length=5)


class ScheduleBlockPatchRequest(StrictRequestModel):
    day_of_week: str | None = Field(None, max_length=16)
    start: str | None = Field(None, min_length=4, max_length=5)
    end: str | None = Field(None, min_length=4, max_length=5)
    label: str | None = Field(None, max_length=64)
    enabled: bool | None = None


class SafetyPatternRulePatchRequest(StrictRequestModel):
    rule_id: str = Field(..., min_length=1, max_length=128)
    rule_group: str | None = Field(None, max_length=64)
    enabled: bool | None = None
    match_type: str | None = Field(None, max_length=16)
    patterns: list[str] | None = Field(None, max_length=100)
    reason_code: str | None = Field(None, max_length=64)
    risk_level: str | None = Field(None, max_length=16)


class SafetyPolicyPatchRequest(StrictRequestModel):
    input_rules: list[SafetyPatternRulePatchRequest] | None = Field(None, max_length=50)
    output_rules: list[SafetyPatternRulePatchRequest] | None = Field(None, max_length=50)
    rule_groups: dict[str, bool] | None = None
    reset_to_defaults: bool | None = None


class SafetyPolicyImportRequest(StrictRequestModel):
    safety_policy: SafetyPolicyPatchRequest


class EmbeddingConfigPatchRequest(StrictRequestModel):
    provider: str | None = Field(None, max_length=64)
    base_url: str | None = Field(None, max_length=500)
    model: str | None = Field(None, max_length=200)
    dimensions: int | None = Field(None, ge=1, le=100000)
    timeout: float | None = Field(None, ge=1, le=300)
    api_key: str | None = Field(None, max_length=1000)


class MiniMaxConfigPatchRequest(StrictRequestModel):
    model: str | None = Field(None, max_length=200)
    api_url: str | None = Field(None, max_length=500)
    timeout: float | None = Field(None, ge=1, le=300)
    api_key: str | None = Field(None, max_length=1000)


class ModelConfigPatchRequest(StrictRequestModel):
    provider: str | None = Field(None, max_length=64)
    minimax: MiniMaxConfigPatchRequest | None = None


class SettingsPatchRequest(StrictRequestModel):
    auto_reply_enabled: bool | None = None
    reply_style: str | None = Field(None, max_length=64)
    new_customer_auto_create: bool | None = None
    sensitive_message_review: bool | None = None
    work_hours: WorkHoursPatchRequest | None = None
    knowledge_chunk_size: int | None = Field(None, ge=100, le=20000)
    knowledge_chunk_overlap: int | None = Field(None, ge=0, le=5000)
    run_silently: bool | None = None
    esc_action: str | None = Field(None, max_length=32)
    force_stop_hotkey: str | None = Field(None, max_length=64)
    schedule_enabled: bool | None = None
    schedule_blocks: list[ScheduleBlockPatchRequest] | None = Field(None, max_length=32)
    privacy: PrivacyPolicyPatchRequest | None = None
    human_takeover_sessions: list[str] | None = Field(None, max_length=500)
    paused_sessions: list[str] | None = Field(None, max_length=500)
    whitelist: list[str] | None = Field(None, max_length=500)
    blacklist: list[str] | None = Field(None, max_length=500)
    request_timeout_seconds: float | None = Field(None, ge=1, le=300)
    retry_attempts: int | None = Field(None, ge=0, le=10)
    real_send_enabled: bool | None = None
    llm_config: ModelConfigPatchRequest | None = Field(None, alias="model_config")
    embedding_config: EmbeddingConfigPatchRequest | None = None
    safety_policy: SafetyPolicyPatchRequest | None = None


class ConversationControlPatchRequest(StrictRequestModel):
    human_takeover: bool | None = None
    paused: bool | None = None
    whitelisted: bool | None = None
    blacklisted: bool | None = None


class SelfIdentityPatchRequest(StrictRequestModel):
    display_name: str | None = Field(None, min_length=1, max_length=64)
    identity_facts: list[str] | None = Field(None, max_length=100)

    @field_validator("identity_facts", mode="after")
    @classmethod
    def reject_blank_identity_facts(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _clean_nonblank_strings(value, field_name="identity_facts")


class SelfIdentityGenerateRequest(StrictRequestModel):
    display_name: str = Field(..., min_length=1, max_length=64)


class CustomerPatchRequest(StrictRequestModel):
    display_name: str | None = Field(None, min_length=1, max_length=64)
    status: str | None = Field(None, min_length=1, max_length=64)
    tags: list[str] | None = Field(None, max_length=20)
    remark: str | None = Field(None, max_length=1000)

    @field_validator("tags", mode="after")
    @classmethod
    def reject_blank_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _clean_nonblank_strings(value, field_name="tags")


def _clean_nonblank_strings(value: list[str], *, field_name: str) -> list[str]:
    cleaned = [item.strip() for item in value]
    if any(not item for item in cleaned):
        raise ValueError(f"{field_name} must not contain blank values")
    return cleaned
