import { apiClient } from "@/lib/api"
import { buildEventsUrl, createEventSource } from "@/lib/events"
import type {
  ApiResponse,
  ConversationControl,
  ConversationControlPatch,
  ConversationDetail,
  ConversationListItem,
  Customer,
  DashboardSummary,
  IdentityCandidate,
  IdentityDraft,
  KnowledgeAcceptanceHistoryRecord,
  KnowledgeAcceptanceReport,
  KnowledgeNormalizePreview,
  KnowledgeNormalizeConfirmResult,
  KnowledgeTask,
  KnowledgeTrustDiagnostics,
  KnowledgeTrustedRebuildResult,
  KnowledgeImportResult,
  KnowledgeSearchResult,
  PrivacyPolicy,
  ReplyJob,
  RuntimeAction,
  RuntimeStatus,
  SendJob,
  SendAttempt,
  SelfIdentity,
  SelfIdentityPatch,
  Settings,
  SettingsPatch,
  WebKnowledgeBuildResult,
  WechatEnvironment,
  RecentLogEvent,
  SafetyPolicyConfig,
  SafetyPolicyImportBody,
} from "@/lib/api"

async function assertApiClientContract() {
  const dashboard: ApiResponse<DashboardSummary> = await apiClient.getDashboardSummary()
  const runtime: ApiResponse<RuntimeStatus> = await apiClient.getRuntimeStatus()
  const recentErrorLogs: ApiResponse<RecentLogEvent[]> = await apiClient.getRecentLogs(5, {
    only_errors: true,
    event_type: "reply.error",
    trace_id: "trace-error",
  })
  const environment: ApiResponse<WechatEnvironment> = await apiClient.getWechatEnvironment()
  const started: ApiResponse<RuntimeAction> = await apiClient.startRuntime()
  const stopped: ApiResponse<RuntimeAction> = await apiClient.stopRuntime()
  const restarted: ApiResponse<RuntimeAction> = await apiClient.restartRuntime()
  const settings: ApiResponse<Settings> = await apiClient.getSettings()
  const embeddingProviderSetting: string | undefined = settings.data?.embedding_config.provider
  const updatedSettings: ApiResponse<Settings> = await apiClient.updateSettings({
    auto_reply_enabled: false,
    embedding_config: { provider: "fake", api_key: "" },
  })
  const exportedSafetyPolicy: ApiResponse<SafetyPolicyConfig> = await apiClient.exportSafetyPolicy()
  const safetyPolicyImportBody: SafetyPolicyImportBody = {
    safety_policy: { rule_groups: { business_risk: false } },
  }
  const importedSafetyPolicy: ApiResponse<SafetyPolicyConfig> = await apiClient.importSafetyPolicy(safetyPolicyImportBody)
  const restoredSafetyPolicy: ApiResponse<SafetyPolicyConfig> = await apiClient.restoreDefaultSafetyPolicy()
  const privacy: ApiResponse<PrivacyPolicy> = await apiClient.getPrivacyPolicy()
  const updatedPrivacy: ApiResponse<PrivacyPolicy> = await apiClient.updatePrivacyPolicy({ log_retention_days: 30 })
  const conversations: ApiResponse<ConversationListItem[]> = await apiClient.listConversations()
  const conversation: ApiResponse<ConversationDetail> = await apiClient.getConversation("friend:zhang")
  const control: ApiResponse<ConversationControl> = await apiClient.getConversationControl("friend:zhang")
  const replyJobs: ApiResponse<ReplyJob[]> = await apiClient.listReplyJobs(undefined, 20)
  const approvedReplyJob: ApiResponse<ReplyJob> = await apiClient.approveReplyJob("reply_001", {
    draft_reply: "manual approved reply",
    reason: "manual_approve",
    reviewed_by: "operator",
    send_after_approve: true,
  })
  const cancelledReplyJob: ApiResponse<ReplyJob> = await apiClient.cancelReplyJob("reply_001", {
    reason: "manual_cancel",
    reviewed_by: "operator",
  })
  const replyAuditReason: string | null | undefined = approvedReplyJob.data?.review_reason
  const replyAuditReviewer: string | null | undefined = approvedReplyJob.data?.reviewed_by
  const replyAuditTime: string | null | undefined = approvedReplyJob.data?.reviewed_at
  const replyReasonCodes: ReplyJob["reason_codes"] = replyJobs.data?.[0]?.reason_codes
  const replySendStatus: string | undefined = approvedReplyJob.data?.send_status
  const replySendResult: ReplyJob["send_result"] = approvedReplyJob.data?.send_result
  const sendJobs: ApiResponse<SendJob[]> = await apiClient.listSendJobs("SEND_UNCERTAIN", 20, {
    unresolved: true,
    conversation_id: "friend:alice",
    error_code: "SEND_NOT_CONFIRMED",
  })
  const sendAttempts: ApiResponse<SendAttempt[]> = await apiClient.listSendAttempts("send_001", 20)
  const uncertainSendJobs: ApiResponse<SendJob[]> = await apiClient.listUncertainSendJobs(20, {
    unresolved: true,
    conversation_id: "friend:alice",
    error_code: "SEND_NOT_CONFIRMED",
  })
  const uncertainMetrics: ApiResponse<import("@/lib/api").SendUncertainMetrics> = await apiClient.getSendUncertainMetrics()
  const unresolvedTotal: number | undefined = uncertainMetrics.data?.unresolved_total
  const recent24h: number | undefined = uncertainMetrics.data?.recent_24h
  const topErrorCode: string | undefined = uncertainMetrics.data?.top_error_codes[0]?.error_code
  const topConversationId: string | undefined = uncertainMetrics.data?.top_conversations[0]?.conversation_id
  const uncertainSendEvidence: SendJob["confirmation_result"] = {
    reason: "send confirmation timed out",
    resolution: "manual_review",
    visible_messages: ["hello", "pending"],
    matched_text: "hello",
    before_screenshot: "runtime/screenshots/before.png",
    after_screenshot: "runtime/screenshots/after.png",
  }
  const resolvedSendJob: ApiResponse<SendJob> = await apiClient.resolveSendJob("send_001", {
    resolution: "confirmed",
    reason: "manual confirmation",
    reviewed_by: "operator",
    unpause_conversation: true,
  })
  const updatedControl: ApiResponse<ConversationControl> = await apiClient.updateConversationControl("friend:zhang", {
    human_takeover: true,
  })
  const customers: ApiResponse<Customer[]> = await apiClient.listCustomers()
  const customer: ApiResponse<Customer> = await apiClient.getCustomer("user_001")
  const updatedCustomer: ApiResponse<Customer> = await apiClient.updateCustomer("user_001", {
    display_name: "张先生",
    tags: ["意向客户"],
    remark: "关注试用",
    status: "follow_up",
  })
  const identityDrafts: ApiResponse<IdentityDraft[]> = await apiClient.listIdentityDrafts()
  const identityCandidates: ApiResponse<IdentityCandidate[]> = await apiClient.listIdentityCandidates()
  const selfIdentity: ApiResponse<SelfIdentity> = await apiClient.getGlobalSelfIdentity()
  const updatedSelfIdentity: ApiResponse<SelfIdentity> = await apiClient.updateGlobalSelfIdentity({
    display_name: "碱水",
    identity_facts: ["我是产品顾问"],
  })
  const knowledgeStatus: ApiResponse<import("@/lib/api").KnowledgeStatus> = await apiClient.getKnowledgeStatus()
  const knowledgeTrustDiagnostics: ApiResponse<KnowledgeTrustDiagnostics> = await apiClient.getKnowledgeTrustDiagnostics()
  const knowledgeBlockedForRealSend: boolean | undefined = knowledgeTrustDiagnostics.data?.blocked_for_real_send
  const knowledgeTrustedRebuildAvailable: boolean | undefined = knowledgeTrustDiagnostics.data?.trusted_rebuild_available
  const knowledgeTrustedRebuildProvider: string | null | undefined = knowledgeTrustDiagnostics.data?.trusted_rebuild_provider
  const knowledgeRecommendedAction: string | undefined = knowledgeTrustDiagnostics.data?.recommended_actions[0]
  const trustedRebuild: ApiResponse<KnowledgeTrustedRebuildResult> = await apiClient.rebuildKnowledgeWithTrustedEmbeddings({
    acceptance_query: "trial policy",
  })
  const trustedRebuildAccepted: boolean | undefined = trustedRebuild.data?.accepted
  const trustedRebuildStatus: string | undefined = trustedRebuild.data?.status
  const embeddingProvider: string | null | undefined = knowledgeStatus.data?.embedding_provider
  const embeddingTrusted: boolean | null | undefined = knowledgeStatus.data?.embedding_trusted
  const knowledgeSearch: ApiResponse<KnowledgeSearchResult[]> = await apiClient.searchKnowledge("试用政策", 5)
  const knowledgeAcceptanceHistory: ApiResponse<KnowledgeAcceptanceHistoryRecord[]> = await apiClient.getKnowledgeAcceptanceHistory(5)
  const historyTrustStatus: "trusted" | "fake" | "untrusted" | "unknown" | undefined =
    knowledgeAcceptanceHistory.data?.[0]?.knowledge_trust_status
  const historyChunkIds: string[] | undefined = knowledgeAcceptanceHistory.data?.[0]?.retrieved_chunk_ids
  const knowledgeSearchEvidence: KnowledgeSearchResult = {
    chunk_id: "chunk_001",
    text: "trial policy",
    score: 0.91,
    metadata: {
      doc_id: "faq",
      source: "faq.md",
      chunk_index: "0",
      retrieval_sources: "dense,keyword",
      dense_score: 0.82,
      keyword_score: 0.67,
      match_terms: "trial,policy",
    },
    evidence: {
      doc_id: "faq",
      source: "faq.md",
      chunk_index: "0",
      retrieval_sources: ["dense", "keyword"],
      dense_score: 0.82,
      keyword_score: 0.67,
      match_terms: ["trial", "policy"],
    },
    doc_id: "faq",
    source: "faq.md",
    chunk_index: "0",
    retrieval_sources: ["dense", "keyword"],
    dense_score: 0.82,
    keyword_score: 0.67,
    match_terms: ["trial", "policy"],
    embedding_provider: "FakeEmbeddings",
    embedding_trusted: false,
    embedding_trust_status: "fake",
    embedding_trust_reason: "fake_embedding_provider",
  }
  const knowledgeDenseScore: number | null | undefined = knowledgeSearch.data?.[0]?.dense_score
  const knowledgeKeywordScore: number | null | undefined = knowledgeSearch.data?.[0]?.keyword_score
  const knowledgeMatchTerms: string[] | undefined = knowledgeSearch.data?.[0]?.match_terms
  const knowledgeTrustStatus: "trusted" | "fake" | "untrusted" | "unknown" | undefined = knowledgeSearch.data?.[0]?.embedding_trust_status
  const knowledgeTasks: ApiResponse<KnowledgeTask[]> = await apiClient.listKnowledgeTasks(5)
  const knowledgeNormalizePreview: ApiResponse<KnowledgeNormalizePreview> = await apiClient.buildKnowledgeNormalizePreview({
    text: "试用政策：支持 7 天体验，退款争议转人工。",
    title: "试用政策",
    source: "policy.md",
  })
  const knowledgeNormalizeConfirm: ApiResponse<KnowledgeNormalizeConfirmResult> = await apiClient.confirmKnowledgeNormalizePreview({
    title: "试用政策",
    source: "policy.md",
    preview: {
      faq_items: [{ question: "如何试用？", answer: "登记后体验。", confidence: "high" }],
      allowed_claims: ["支持登记体验"],
      forbidden_claims: ["不能承诺资料外结果"],
      handoff_rules: ["退款争议转人工"],
      source_excerpt: "试用政策",
      warnings: [],
    },
  })
  const knowledgeAcceptanceReport: ApiResponse<KnowledgeAcceptanceReport> = await apiClient.buildKnowledgeAcceptanceReport({
    questions: ["试用政策是什么？"],
    limit: 3,
    min_top_score: 0.7,
  })
  const knowledgeTaskStatus: string | undefined = knowledgeTasks.data?.[0]?.status
  const knowledgeTaskStage: string | undefined = knowledgeTasks.data?.[0]?.stage
  const knowledgeNormalizeQuestion: string | undefined = knowledgeNormalizePreview.data?.faq_items[0]?.question
  const knowledgeNormalizeFileName: string | undefined = knowledgeNormalizeConfirm.data?.file_name
  const knowledgeAcceptanceVerdict: string | undefined = knowledgeAcceptanceReport.data?.items[0]?.verdict
  const knowledgeImport: ApiResponse<KnowledgeImportResult> = await apiClient.importKnowledgeFiles([
    "C:\\docs\\product.pdf",
  ])
  const webKnowledge: ApiResponse<WebKnowledgeBuildResult> = await apiClient.buildWebKnowledgeFromDocuments([
    "C:\\docs\\brief.docx",
  ], 3)
  const patch: SettingsPatch = { reply_style: "专业友好", sensitive_message_review: true }
  const controlPatch: ConversationControlPatch = { paused: true }
  const selfIdentityPatch: SelfIdentityPatch = { identity_facts: ["默认保持专业友好"] }
  const eventsUrl: string = buildEventsUrl({ replay: 5 })
  const eventSourceFactory: typeof createEventSource = createEventSource

  return {
    dashboard,
    runtime,
    recentErrorLogs,
    environment,
    started,
    stopped,
    restarted,
    settings,
    embeddingProviderSetting,
    updatedSettings,
    exportedSafetyPolicy,
    importedSafetyPolicy,
    restoredSafetyPolicy,
    privacy,
    updatedPrivacy,
    conversations,
    conversation,
    control,
    replyJobs,
    approvedReplyJob,
    cancelledReplyJob,
    replyAuditReason,
    replyAuditReviewer,
    replyAuditTime,
    replyReasonCodes,
    replySendStatus,
    replySendResult,
    unresolvedTotal,
    recent24h,
    topErrorCode,
    topConversationId,
    sendJobs,
    sendAttempts,
    uncertainSendJobs,
    uncertainSendEvidence,
    resolvedSendJob,
    updatedControl,
    customers,
    customer,
    updatedCustomer,
    identityDrafts,
    identityCandidates,
    selfIdentity,
    updatedSelfIdentity,
    knowledgeStatus,
    knowledgeTrustDiagnostics,
    knowledgeBlockedForRealSend,
    knowledgeTrustedRebuildAvailable,
    knowledgeTrustedRebuildProvider,
    knowledgeRecommendedAction,
    trustedRebuild,
    trustedRebuildAccepted,
    trustedRebuildStatus,
    embeddingProvider,
    embeddingTrusted,
    knowledgeSearch,
    knowledgeAcceptanceHistory,
    historyTrustStatus,
    historyChunkIds,
    knowledgeSearchEvidence,
    knowledgeDenseScore,
    knowledgeKeywordScore,
    knowledgeMatchTerms,
    knowledgeTasks,
    knowledgeNormalizePreview,
    knowledgeNormalizeConfirm,
    knowledgeAcceptanceReport,
    knowledgeTaskStatus,
    knowledgeTaskStage,
    knowledgeNormalizeQuestion,
    knowledgeNormalizeFileName,
    knowledgeAcceptanceVerdict,
    knowledgeImport,
    webKnowledge,
    patch,
    controlPatch,
    selfIdentityPatch,
    eventsUrl,
    eventSourceFactory,
  }
}

void assertApiClientContract
