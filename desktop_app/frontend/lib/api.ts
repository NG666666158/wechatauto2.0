export type ApiErrorPayload = {
  code: string
  message: string
  detail?: unknown
}

export type ApiResponse<T> = {
  success: boolean
  data: T | null
  error: ApiErrorPayload | null
  trace_id: string
}

export type DaemonStatus = {
  state: string
  pid: number | null
  run_silently: boolean
  last_heartbeat: string | null
  last_started_at: string | null
  last_stopped_at: string | null
  last_error: string | null
  consecutive_errors: number
  retry_backoff_seconds: number
  next_retry_at: string | null
  today_received: number
  today_replied: number
}

export type AppStatus = {
  wechat_status: string
  daemon_state: string
  auto_reply_enabled: boolean
  today_received: number
  today_replied: number
  pending_count: number
  knowledge_index_ready: boolean
  last_heartbeat: string | null
}

export type RuntimeStatus = {
  state: string
  mode: string
  running: boolean
  daemon: DaemonStatus
  app: AppStatus
}

export type RuntimeBootstrap = {
  ok: boolean
  wechat_started: boolean
  narrator_started: boolean
  ui_ready: boolean
  guardian_started: boolean
  narrator_stopped: boolean
  attempts: number
  message: string
  guardian_command: string[]
  guardian_exit_code: number | null
  status_lines: string[]
  environment: Record<string, unknown>
}

export type RuntimeAction = RuntimeStatus & {
  bootstrap?: RuntimeBootstrap | null
}

export type KnowledgeStatus = {
  ready: boolean
  index_path: string
  documents_loaded: number
  chunks_created: number
  last_built_at: string | null
  embedding_provider: string | null
  embedding_trusted?: boolean | null
  supported_extensions: string[]
}

export type KnowledgeTrustDiagnostics = {
  ready: boolean
  embedding_provider: string | null
  embedding_trusted: boolean
  trust_status: "trusted" | "fake" | "untrusted" | "unknown"
  trust_reason: string
  real_send_enabled: boolean
  blocked_for_real_send: boolean
  trusted_rebuild_available: boolean
  trusted_rebuild_provider: string | null
  trusted_rebuild_block_reason: string
  recommended_actions: string[]
}

export type KnowledgeTrustedRebuildRequest = {
  acceptance_query?: string
}

export type KnowledgeTrustedRebuildResult = {
  accepted: boolean
  status: string
  reason_code: string
  reason: string
  trusted_rebuild_provider: string | null
  trusted_rebuild_block_reason: string
  index_status: KnowledgeStatus
  trust_diagnostics: KnowledgeTrustDiagnostics
  acceptance_snapshot: KnowledgeAcceptanceSnapshot | null
}

export type KnowledgeAcceptanceHistoryRecord = {
  created_at: string
  imported_files: string[]
  search_query: string
  retrieved_chunk_ids: string[]
  knowledge_ready: boolean
  embedding_provider: string | null
  embedding_trusted: boolean
  knowledge_trust_status: "trusted" | "fake" | "untrusted" | "unknown"
  web_build_status: string
}

export type KnowledgeSearchResult = {
  chunk_id: string
  text: string
  score: number
  metadata?: Record<string, unknown>
  evidence?: Record<string, unknown>
  retrieval_sources?: string[]
  dense_score?: number | null
  keyword_score?: number | null
  match_terms?: string[]
  doc_id?: string
  source?: string
  chunk_index?: string
  embedding_provider?: string | null
  embedding_trusted?: boolean | null
  embedding_trust_status?: "trusted" | "fake" | "untrusted" | "unknown"
  embedding_trust_reason?: string
}

export type KnowledgeAcceptanceSnapshot = {
  imported_files: string[]
  search_query: string
  retrieved_chunk_ids: string[]
  retrieved_chunks: KnowledgeSearchResult[]
  knowledge_status: KnowledgeStatus
  web_build_status: string
}

export type KnowledgeFileImport = {
  file_name: string
  status: string
}

export type KnowledgeImportResult = {
  files: KnowledgeFileImport[]
  index_rebuilt: boolean
}

export type WebKnowledgeBuildResult = {
  documents: string[]
  search_limit: number
  status: string
}

export type KnowledgeTask = {
  id: string
  type: string
  title: string
  status: string
  stage: string
  created_at: string
  updated_at: string
  summary: string
  error: string
  metadata: Record<string, unknown>
}

export type KnowledgeNormalizeFaqItem = {
  question: string
  answer: string
  confidence: string
}

export type KnowledgeNormalizePreview = {
  faq_items: KnowledgeNormalizeFaqItem[]
  allowed_claims: string[]
  forbidden_claims: string[]
  handoff_rules: string[]
  source_excerpt: string
  warnings: string[]
}

export type KnowledgeNormalizeConfirmRequest = {
  title?: string
  source?: string
  preview: KnowledgeNormalizePreview
}

export type KnowledgeNormalizeConfirmResult = {
  file_path: string
  file_name: string
  metadata: Record<string, unknown>
  import_result: KnowledgeImportResult | Record<string, unknown>
}

export type KnowledgeAcceptanceReportItem = {
  query: string
  top_chunk_id: string | null
  top_score: number | null
  source: string
  retrieval_sources: string[]
  match_terms: string[]
  trust_status: string
  verdict: string
}

export type KnowledgeAcceptanceReport = {
  total_questions: number
  answered_questions: number
  missing_questions: number
  average_top_score: number
  trusted_result_count: number
  needs_review: boolean
  items: KnowledgeAcceptanceReportItem[]
  markdown: string
}

export type KnowledgeAcceptanceReportRequest = {
  questions: string[]
  limit?: number
  min_top_score?: number
}

export type EmbeddingConfig = {
  provider: string
  base_url: string
  model: string
  dimensions: number | null
  timeout: number
  api_key_set: boolean
  api_key_preview: string
}

export type EmbeddingConfigPatch = Partial<Omit<EmbeddingConfig, "api_key_set" | "api_key_preview">> & {
  api_key?: string
}

export type MiniMaxModelConfig = {
  model: string
  api_url: string
  timeout: number
  api_key_set: boolean
  api_key_preview: string
}

export type ModelConfig = {
  provider: "minimax"
  minimax: MiniMaxModelConfig
}

export type MiniMaxModelConfigPatch = Partial<Omit<MiniMaxModelConfig, "api_key_set" | "api_key_preview">> & {
  api_key?: string
}

export type ModelConfigPatch = {
  provider?: "minimax"
  minimax?: MiniMaxModelConfigPatch
}

export type KnowledgeNormalizePreviewRequest = {
  text: string
  title?: string
  source?: string
}

export type DashboardSummary = {
  app: AppStatus
  runtime: RuntimeStatus
  knowledge: KnowledgeStatus
  pending: {
    identity_drafts: number
    identity_candidates: number
  }
  activity: {
    today_received_messages: number
    today_replied_messages: number
    today_replied_conversations: number
    pending_total: number
    pending_reply_jobs: number
    pending_identity_items: number
    pending_send_uncertain: number
  }
  send_uncertain?: SendUncertainMetrics
}

export type SendUncertainMetrics = {
  unresolved_total: number
  recent_24h: number
  top_error_codes: Array<{
    error_code: string
    count: number
  }>
  top_conversations: Array<{
    conversation_id: string
    target_title: string
    count: number
  }>
}

export type LogsSummary = {
  recent_count: number
  recent_error_count: number
  last_event_time: string | null
}

export type WechatEnvironment = {
  wechat_running: boolean
  narrator_required: boolean
  ui_ready: boolean | string
}

export type RecentLogEvent = {
  timestamp?: string
  event_type?: string
  trace_id?: string
  message?: string
  reason_code?: string
  [key: string]: unknown
}

export type RecentLogFilters = {
  only_errors?: boolean
  event_type?: string
  trace_id?: string
}

export type SendJobListFilters = {
  unresolved?: boolean
  conversation_id?: string
  error_code?: string
}

export type WorkHours = {
  enabled: boolean
  start_day: string
  end_day: string
  start: string
  end: string
}

export type PrivacyPolicy = {
  redact_sensitive_logs: boolean
  log_retention_days: number
  memory_retention_days: number
  max_recent_log_events: number
}

export type SafetyPatternRule = {
  rule_id: string
  rule_group?: string
  enabled: boolean
  match_type: string
  patterns: string[]
  reason_code: string
  risk_level: string
}

export type SafetyPolicyConfig = {
  input_rules: SafetyPatternRule[]
  output_rules: SafetyPatternRule[]
  rule_groups?: Record<string, boolean>
}

export type SafetyPolicyPatch = Partial<SafetyPolicyConfig> & {
  rule_groups?: Record<string, boolean>
  reset_to_defaults?: boolean
}

export type SafetyPolicyImportBody = {
  safety_policy: SafetyPolicyPatch
}

export type Settings = {
  auto_reply_enabled: boolean
  reply_style: string
  new_customer_auto_create: boolean
  sensitive_message_review: boolean
  work_hours: WorkHours
  knowledge_chunk_size: number
  knowledge_chunk_overlap: number
  run_silently: boolean
  esc_action: string
  force_stop_hotkey: string
  schedule_enabled: boolean
  schedule_blocks: Array<{
    day_of_week: string
    start: string
    end: string
    label: string
    enabled: boolean
  }>
  privacy: PrivacyPolicy
  human_takeover_sessions: string[]
  paused_sessions: string[]
  whitelist: string[]
  blacklist: string[]
  request_timeout_seconds: number
  retry_attempts: number
  real_send_enabled: boolean
  model_config: ModelConfig
  embedding_config: EmbeddingConfig
  safety_policy: SafetyPolicyConfig
}

export type SettingsPatch = Partial<
  Omit<
    Settings,
    | "safety_policy"
    | "model_config"
    | "embedding_config"
  >
> & { safety_policy?: SafetyPolicyPatch; model_config?: ModelConfigPatch; embedding_config?: EmbeddingConfigPatch }

export type PrivacyPolicyPatch = Partial<PrivacyPolicy>

export type ConversationListItem = {
  conversation_id: string
  title: string
  is_group: boolean
  latest_message: string
  unread_count: number
  updated_at: string | null
}

export type ConversationMessage = {
  message_id: string
  conversation_id: string
  sender: string
  text: string
  direction: "incoming" | "outgoing" | string
  sent_at: string | null
}

export type ConversationControl = {
  conversation_id: string
  human_takeover: boolean
  paused: boolean
  whitelisted: boolean
  blacklisted: boolean
}

export type ConversationDetail = {
  conversation: ConversationListItem
  messages: ConversationMessage[]
  control: ConversationControl
}

export type ReplySuggestion = {
  conversation_id: string
  input_text: string
  suggestion: string
  status: string
  knowledge_trust_status?: "trusted" | "fake" | "untrusted" | "unknown"
  knowledge_trust_reason?: string
  embedding_provider?: string | null
  embedding_trusted?: boolean | null
}

export type KnowledgeEvidenceSummary = {
  doc_id: string
  source: string
  chunk_index: string
  text: string
  score?: number | null
  knowledge_trust_status?: "trusted" | "fake" | "untrusted" | "unknown"
  knowledge_trust_reason?: string
}

export type ReplyJobMetadata = Record<string, unknown> & {
  knowledge_evidence?: KnowledgeEvidenceSummary[]
}

export type ReplyJob = {
  reply_job_id: string
  conversation_id: string
  trigger_event_ids?: string[] | string
  input_text: string
  context_snapshot_id?: string | null
  status: string
  draft_reply?: string | null
  risk_level?: string
  need_human_review?: boolean | number
  reason_codes?: string[] | string | null
  idempotency_key?: string
  created_at?: string | null
  updated_at?: string | null
  review_reason?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  send_status?: string
  send_result?: Record<string, unknown>
  metadata?: ReplyJobMetadata
}

export type SendConfirmationResult = Record<string, unknown> & {
  reason?: unknown
  resolution?: unknown
  reviewed_by?: unknown
  operator?: unknown
  resolved_at?: unknown
  resolution_note?: unknown
  review_reason?: unknown
  visible_messages?: unknown
  matched_text?: unknown
  before_screenshot?: unknown
  after_screenshot?: unknown
}

export type SendJob = {
  send_job_id: string
  reply_job_id?: string
  conversation_id: string
  target_title?: string
  content: string
  status: string
  idempotency_key?: string
  lock_owner?: string | null
  before_screenshot?: string | null
  after_screenshot?: string | null
  confirmation_result?: SendConfirmationResult | string | null
  created_at?: string | null
  updated_at?: string | null
}

export type SendAttempt = {
  attempt_id: string
  send_job_id: string
  attempt_no: number
  status: string
  error_code?: string | null
  error_message?: string | null
  before_screenshot?: string | null
  after_screenshot?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export type ReplyJobApproveBody = {
  draft_reply?: string
  reason?: string
  reviewed_by?: string
  send_after_approve?: boolean
}

export type ReplyJobCancelBody = {
  reason?: string
  reviewed_by?: string
}

export type SendJobResolveBody = {
  resolution: "confirmed" | "failed"
  reason?: string
  reviewed_by?: string
  unpause_conversation?: boolean
}

export type SendReplyResult = {
  status: string
  allowed: boolean
  conversation_id: string
  text: string
  reason_code: string
  reason: string
}

export type ConversationControlPatch = Partial<Pick<ConversationControl, "human_takeover" | "paused" | "whitelisted" | "blacklisted">>

export type Customer = {
  customer_id: string
  display_name: string
  status: string
  tags: string[]
  remark: string
  last_contact_at: string | null
}

export type CustomerPatch = Partial<Pick<Customer, "display_name" | "status" | "tags" | "remark">>

export type IdentityDraft = {
  draft_user_id: string
}

export type IdentityCandidate = {
  candidate_id: string
}

export type SelfIdentity = {
  display_name: string
  identity_facts: string[]
}

export type SelfIdentityPatch = Partial<SelfIdentity>

export type SelfIdentityGenerateRequest = {
  display_name: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_WECHAT_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8765/api/v1"

const BOOTSTRAP_READY_TIMEOUT_SECONDS = 120
const BOOTSTRAP_POLL_INTERVAL_SECONDS = 1
const BOOTSTRAP_NARRATOR_SETTLE_SECONDS = 10
const STRICT_BOOTSTRAP_PAYLOAD = {
  mode: "global",
  ready_timeout_seconds: BOOTSTRAP_READY_TIMEOUT_SECONDS,
  poll_interval_seconds: BOOTSTRAP_POLL_INTERVAL_SECONDS,
  narrator_settle_seconds: BOOTSTRAP_NARRATOR_SETTLE_SECONDS,
  wait_for_ui_ready_before_guardian: true,
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
  const payload = (await response.json()) as ApiResponse<T> & { detail?: unknown }
  if (!response.ok) {
    const detailMessage =
      typeof payload.detail === "string"
        ? payload.detail
        : Array.isArray(payload.detail)
          ? payload.detail
              .map((item) =>
                item && typeof item === "object" && "msg" in item ? String((item as { msg?: unknown }).msg) : "",
              )
              .filter(Boolean)
              .join("；")
          : ""
    return {
      success: false,
      data: null,
      error: payload.error ?? {
        code: `HTTP_${response.status}`,
        message: detailMessage || response.statusText || "Request failed",
      },
      trace_id: payload.trace_id ?? response.headers.get("x-trace-id") ?? "",
    }
  }
  return payload
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function postForm<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body: formData,
    cache: "no-store",
  })
  const payload = (await response.json()) as ApiResponse<T> & { detail?: unknown }
  if (!response.ok) {
    return {
      success: false,
      data: null,
      error: payload.error ?? {
        code: `HTTP_${response.status}`,
        message: response.statusText || "Request failed",
      },
      trace_id: payload.trace_id ?? response.headers.get("x-trace-id") ?? "",
    }
  }
  return payload
}

function patch<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

function withQuery(path: string, params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      query.set(key, String(value))
    }
  }
  const queryString = query.toString()
  return queryString ? `${path}?${queryString}` : path
}

export const apiClient = {
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  getRuntimeStatus: () => request<RuntimeStatus>("/runtime/status"),
  getLogsSummary: (limit = 20) => request<LogsSummary>(`/logs/summary?limit=${limit}`),
  getRecentLogs: (limit = 5, filters: RecentLogFilters = {}) =>
    request<RecentLogEvent[]>(withQuery("/logs/recent", { limit, ...filters })),
  getWechatEnvironment: () => request<WechatEnvironment>("/environment/wechat"),
  startRuntime: () =>
    post<RuntimeAction>("/runtime/bootstrap-start", STRICT_BOOTSTRAP_PAYLOAD),
  bootstrapCheckRuntime: () =>
    post<RuntimeAction>("/runtime/bootstrap-check", STRICT_BOOTSTRAP_PAYLOAD),
  bootstrapStartRuntime: () =>
    post<RuntimeAction>("/runtime/bootstrap-start", STRICT_BOOTSTRAP_PAYLOAD),
  stopRuntime: () => post<RuntimeAction>("/runtime/stop"),
  forceStopRuntime: () => post<RuntimeAction>("/runtime/force-stop"),
  restartRuntime: () =>
    post<RuntimeAction>("/runtime/bootstrap-start", STRICT_BOOTSTRAP_PAYLOAD),
  getSettings: () => request<Settings>("/settings"),
  updateSettings: (patchBody: SettingsPatch) => patch<Settings>("/settings", patchBody),
  exportSafetyPolicy: () => request<SafetyPolicyConfig>("/settings/safety-policy/export"),
  importSafetyPolicy: (body: SafetyPolicyImportBody) => post<SafetyPolicyConfig>("/settings/safety-policy/import", body),
  restoreDefaultSafetyPolicy: () => post<SafetyPolicyConfig>("/settings/safety-policy/restore-defaults"),
  getPrivacyPolicy: () => request<PrivacyPolicy>("/privacy/policy"),
  updatePrivacyPolicy: (patchBody: PrivacyPolicyPatch) => patch<PrivacyPolicy>("/privacy/policy", patchBody),
  listConversations: () => request<ConversationListItem[]>("/conversations"),
  getConversation: (conversationId: string) => request<ConversationDetail>(`/conversations/${encodeURIComponent(conversationId)}`),
  getConversationControl: (conversationId: string) =>
    request<ConversationControl>(`/controls/conversations/${encodeURIComponent(conversationId)}`),
  updateConversationControl: (conversationId: string, patchBody: ConversationControlPatch) =>
    patch<ConversationControl>(`/controls/conversations/${encodeURIComponent(conversationId)}`, patchBody),
  listReplyJobs: (status?: string, limit = 100) =>
    request<ReplyJob[]>(withQuery("/jobs/reply", { status, limit })),
  approveReplyJob: (replyJobId: string, body?: ReplyJobApproveBody) =>
    post<ReplyJob>(`/jobs/reply/${encodeURIComponent(replyJobId)}/approve`, body),
  cancelReplyJob: (replyJobId: string, body?: ReplyJobCancelBody) =>
    post<ReplyJob>(`/jobs/reply/${encodeURIComponent(replyJobId)}/cancel`, body),
  listSendJobs: (status?: string, limit = 100, filters: SendJobListFilters = {}) =>
    request<SendJob[]>(withQuery("/jobs/send", { status, limit, ...filters })),
  listSendAttempts: (sendJobId: string, limit = 100) =>
    request<SendAttempt[]>(withQuery(`/jobs/send/${encodeURIComponent(sendJobId)}/attempts`, { limit })),
  resolveSendJob: (sendJobId: string, body: SendJobResolveBody) =>
    post<SendJob>(`/jobs/send/${encodeURIComponent(sendJobId)}/resolve`, body),
  listUncertainSendJobs: (limit = 100, filters: SendJobListFilters = {}) =>
    request<SendJob[]>(withQuery("/jobs/send-uncertain", { limit, ...filters })),
  getSendUncertainMetrics: () => request<SendUncertainMetrics>("/jobs/send-uncertain/metrics"),
  listCustomers: () => request<Customer[]>("/customers"),
  getCustomer: (customerId: string) => request<Customer>(`/customers/${encodeURIComponent(customerId)}`),
  updateCustomer: (customerId: string, patchBody: CustomerPatch) =>
    patch<Customer>(`/customers/${encodeURIComponent(customerId)}`, patchBody),
  listIdentityDrafts: () => request<IdentityDraft[]>("/identity/drafts"),
  listIdentityCandidates: () => request<IdentityCandidate[]>("/identity/candidates"),
  getGlobalSelfIdentity: () => request<SelfIdentity>("/identity/self/global"),
  generateGlobalSelfIdentity: (body: SelfIdentityGenerateRequest) => post<SelfIdentity>("/identity/self/global/generate", body),
  updateGlobalSelfIdentity: (patchBody: SelfIdentityPatch) => patch<SelfIdentity>("/identity/self/global", patchBody),
  getKnowledgeStatus: () => request<KnowledgeStatus>("/knowledge/status"),
  getKnowledgeTrustDiagnostics: () => request<KnowledgeTrustDiagnostics>("/knowledge/trust-diagnostics"),
  rebuildKnowledgeWithTrustedEmbeddings: (body: KnowledgeTrustedRebuildRequest = {}) =>
    post<KnowledgeTrustedRebuildResult>("/knowledge/trusted-rebuild", body),
  getKnowledgeAcceptanceHistory: (limit = 20) =>
    request<KnowledgeAcceptanceHistoryRecord[]>(withQuery("/debug/knowledge-acceptance/history", { limit })),
  buildKnowledgeAcceptanceSnapshot: (query: string) =>
    request<KnowledgeAcceptanceSnapshot>(`/debug/knowledge-acceptance?q=${encodeURIComponent(query)}`),
  searchKnowledge: (query: string, limit = 3) =>
    request<KnowledgeSearchResult[]>(`/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  listKnowledgeTasks: (limit = 20) => request<KnowledgeTask[]>(withQuery("/knowledge/tasks", { limit })),
  buildKnowledgeNormalizePreview: (body: KnowledgeNormalizePreviewRequest) =>
    post<KnowledgeNormalizePreview>("/knowledge/ai-normalize-preview", body),
  confirmKnowledgeNormalizePreview: (body: KnowledgeNormalizeConfirmRequest) =>
    post<KnowledgeNormalizeConfirmResult>("/knowledge/ai-normalize-confirm", body),
  buildKnowledgeAcceptanceReport: (body: KnowledgeAcceptanceReportRequest) =>
    post<KnowledgeAcceptanceReport>("/knowledge/acceptance-report", body),
  importKnowledgeFiles: (filePaths: string[]) => post<KnowledgeImportResult>("/knowledge/import", { file_paths: filePaths }),
  uploadKnowledgeFiles: (files: File[]) => {
    const formData = new FormData()
    for (const file of files) {
      formData.append("files", file, file.name)
    }
    return postForm<KnowledgeImportResult>("/knowledge/upload", formData)
  },
  buildWebKnowledgeFromDocuments: (filePaths: string[], searchLimit = 5) =>
    post<WebKnowledgeBuildResult>("/knowledge/web-build", { file_paths: filePaths, search_limit: searchLimit }),
}
