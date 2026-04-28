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
  KnowledgeImportResult,
  KnowledgeSearchResult,
  PrivacyPolicy,
  ReplyJob,
  ReplySuggestion,
  RuntimeAction,
  RuntimeStatus,
  SendJob,
  SendAttempt,
  SendReplyResult,
  SelfIdentity,
  SelfIdentityPatch,
  Settings,
  SettingsPatch,
  WebKnowledgeBuildResult,
  WechatEnvironment,
} from "@/lib/api"

async function assertApiClientContract() {
  const dashboard: ApiResponse<DashboardSummary> = await apiClient.getDashboardSummary()
  const runtime: ApiResponse<RuntimeStatus> = await apiClient.getRuntimeStatus()
  const environment: ApiResponse<WechatEnvironment> = await apiClient.getWechatEnvironment()
  const started: ApiResponse<RuntimeAction> = await apiClient.startRuntime()
  const stopped: ApiResponse<RuntimeAction> = await apiClient.stopRuntime()
  const restarted: ApiResponse<RuntimeAction> = await apiClient.restartRuntime()
  const settings: ApiResponse<Settings> = await apiClient.getSettings()
  const updatedSettings: ApiResponse<Settings> = await apiClient.updateSettings({ auto_reply_enabled: false })
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
  const sendJobs: ApiResponse<SendJob[]> = await apiClient.listSendJobs("SEND_UNCERTAIN", 20)
  const sendAttempts: ApiResponse<SendAttempt[]> = await apiClient.listSendAttempts("send_001", 20)
  const uncertainSendJobs: ApiResponse<SendJob[]> = await apiClient.listUncertainSendJobs(20)
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
  const suggestion: ApiResponse<ReplySuggestion> = await apiClient.suggestReply("friend:zhang", "请介绍一下试用政策")
  const sent: ApiResponse<SendReplyResult> = await apiClient.sendConversationReply("friend:zhang", "您好，稍后为您介绍。")
  const updatedControl: ApiResponse<ConversationControl> = await apiClient.updateConversationControl("friend:zhang", {
    human_takeover: true,
  })
  const customers: ApiResponse<Customer[]> = await apiClient.listCustomers()
  const customer: ApiResponse<Customer> = await apiClient.getCustomer("user_001")
  const identityDrafts: ApiResponse<IdentityDraft[]> = await apiClient.listIdentityDrafts()
  const identityCandidates: ApiResponse<IdentityCandidate[]> = await apiClient.listIdentityCandidates()
  const selfIdentity: ApiResponse<SelfIdentity> = await apiClient.getGlobalSelfIdentity()
  const updatedSelfIdentity: ApiResponse<SelfIdentity> = await apiClient.updateGlobalSelfIdentity({
    display_name: "碱水",
    identity_facts: ["我是产品顾问"],
  })
  const knowledgeStatus: ApiResponse<import("@/lib/api").KnowledgeStatus> = await apiClient.getKnowledgeStatus()
  const embeddingProvider: string | null | undefined = knowledgeStatus.data?.embedding_provider
  const embeddingTrusted: boolean | null | undefined = knowledgeStatus.data?.embedding_trusted
  const knowledgeSearch: ApiResponse<KnowledgeSearchResult[]> = await apiClient.searchKnowledge("试用政策", 5)
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
    environment,
    started,
    stopped,
    restarted,
    settings,
    updatedSettings,
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
    sendJobs,
    sendAttempts,
    uncertainSendJobs,
    uncertainSendEvidence,
    resolvedSendJob,
    suggestion,
    sent,
    updatedControl,
    customers,
    customer,
    identityDrafts,
    identityCandidates,
    selfIdentity,
    updatedSelfIdentity,
    knowledgeStatus,
    embeddingProvider,
    embeddingTrusted,
    knowledgeSearch,
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
