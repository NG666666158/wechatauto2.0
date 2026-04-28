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

export type DashboardSummary = {
  app: AppStatus
  runtime: RuntimeStatus
  knowledge: KnowledgeStatus
  pending: {
    identity_drafts: number
    identity_candidates: number
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

export type SafetyPolicyAuditRecord = {
  timestamp: string
  action: string
  changed_rule_groups: Record<string, boolean>
  reset_to_defaults: boolean
  operator: string
  source: string
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
  safety_policy: SafetyPolicyConfig
}

export type SettingsPatch = Partial<
  Omit<
    Settings,
    | "safety_policy"
  >
> & { safety_policy?: SafetyPolicyPatch }

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
  const payload = (await response.json()) as ApiResponse<T>
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

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  })
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
  getSafetyPolicyAudit: (limit = 20) => request<SafetyPolicyAuditRecord[]>(withQuery("/settings/safety-policy/audit", { limit })),
  exportSafetyPolicy: () => request<SafetyPolicyConfig>("/settings/safety-policy/export"),
  importSafetyPolicy: (body: SafetyPolicyImportBody) => post<SafetyPolicyConfig>("/settings/safety-policy/import", body),
  restoreDefaultSafetyPolicy: () => post<SafetyPolicyConfig>("/settings/safety-policy/restore-defaults"),
  getPrivacyPolicy: () => request<PrivacyPolicy>("/privacy/policy"),
  updatePrivacyPolicy: (patchBody: PrivacyPolicyPatch) => patch<PrivacyPolicy>("/privacy/policy", patchBody),
  listConversations: () => request<ConversationListItem[]>("/conversations"),
  getConversation: (conversationId: string) => request<ConversationDetail>(`/conversations/${encodeURIComponent(conversationId)}`),
  suggestReply: (conversationId: string, messageText: string) =>
    post<ReplySuggestion>(`/conversations/${encodeURIComponent(conversationId)}/suggest`, { message_text: messageText }),
  sendConversationReply: (conversationId: string, text: string) =>
    post<SendReplyResult>(`/conversations/${encodeURIComponent(conversationId)}/send`, { text }),
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
  listIdentityDrafts: () => request<IdentityDraft[]>("/identity/drafts"),
  listIdentityCandidates: () => request<IdentityCandidate[]>("/identity/candidates"),
  getGlobalSelfIdentity: () => request<SelfIdentity>("/identity/self/global"),
  updateGlobalSelfIdentity: (patchBody: SelfIdentityPatch) => patch<SelfIdentity>("/identity/self/global", patchBody),
  getKnowledgeStatus: () => request<KnowledgeStatus>("/knowledge/status"),
  getKnowledgeAcceptanceHistory: (limit = 20) =>
    request<KnowledgeAcceptanceHistoryRecord[]>(withQuery("/debug/knowledge-acceptance/history", { limit })),
  buildKnowledgeAcceptanceSnapshot: (query: string) =>
    request<KnowledgeAcceptanceSnapshot>(`/debug/knowledge-acceptance?q=${encodeURIComponent(query)}`),
  searchKnowledge: (query: string, limit = 3) =>
    request<KnowledgeSearchResult[]>(`/knowledge/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  importKnowledgeFiles: (filePaths: string[]) => post<KnowledgeImportResult>("/knowledge/import", { file_paths: filePaths }),
  buildWebKnowledgeFromDocuments: (filePaths: string[], searchLimit = 5) =>
    post<WebKnowledgeBuildResult>("/knowledge/web-build", { file_paths: filePaths, search_limit: searchLimit }),
}
