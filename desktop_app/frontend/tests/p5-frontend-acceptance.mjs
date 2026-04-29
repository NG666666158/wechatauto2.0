import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"

const root = fileURLToPath(new URL("..", import.meta.url))

const checks = [
  {
    name: "five primary pages exist",
    run: () =>
      [
        "app/page.tsx",
        "app/messages/page.tsx",
        "app/pending/page.tsx",
        "app/customers/page.tsx",
        "app/knowledge/page.tsx",
        "app/settings/page.tsx",
      ].every((file) => existsSync(join(root, file))),
  },
  {
    name: "sidebar exposes pending between messages and customers",
    run: () => {
      const source = read("components/app-sidebar.tsx")
      const messages = source.indexOf('href: "/messages"')
      const pending = source.indexOf('href: "/pending"')
      const customers = source.indexOf('href: "/customers"')
      return messages > -1 && pending > messages && customers > pending
    },
  },
  {
    name: "sidebar exposes knowledge between customers and settings",
    run: () => {
      const source = read("components/app-sidebar.tsx")
      const customers = source.indexOf('href: "/customers"')
      const knowledge = source.indexOf('href: "/knowledge"')
      const settings = source.indexOf('href: "/settings"')
      return customers > -1 && knowledge > customers && settings > knowledge
    },
  },
  {
    name: "api client covers dashboard settings messages customers knowledge",
    run: () => {
      const source = read("lib/api.ts")
      return [
        "getDashboardSummary",
        "getSettings",
        "listConversations",
        "listReplyJobs",
        "listSendJobs",
        "listSendAttempts",
        "resolveSendJob",
        "listUncertainSendJobs",
        "getSendUncertainMetrics",
        "SendUncertainMetrics",
        "listCustomers",
        "updateCustomer",
        "updateGlobalSelfIdentity",
        "getKnowledgeStatus",
        "searchKnowledge",
        "importKnowledgeFiles",
        "buildWebKnowledgeFromDocuments",
        "listKnowledgeTasks",
        "buildKnowledgeNormalizePreview",
        "confirmKnowledgeNormalizePreview",
        "buildKnowledgeAcceptanceReport",
        "getKnowledgeAcceptanceHistory",
        "getKnowledgeTrustDiagnostics",
        "rebuildKnowledgeWithTrustedEmbeddings",
        "KnowledgeTrustDiagnostics",
        "KnowledgeTrustedRebuildResult",
        "KnowledgeAcceptanceHistoryRecord",
        "getRecentLogs",
        "RecentLogFilters",
        "only_errors",
        "event_type",
        "trace_id",
      ].every((token) => source.includes(token))
    },
  },
  {
    name: "customers page edits customer identity fields inline",
    run: () => {
      const source = read("app/customers/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("saveCustomer") &&
        source.includes("editingCustomer") &&
        source.includes("客户名称") &&
        source.includes("备注") &&
        source.includes("交给模型作为用户身份依据") &&
        !source.includes("CustomerIdentityCard") &&
        apiSource.includes("updateCustomer")
      )
    },
  },
  {
    name: "home page omits send uncertain risk overview",
    run: () => {
      const source = read("app/page.tsx")
      return (
        !source.includes("getSendUncertainMetrics") &&
        !source.includes("SendUncertainRiskOverview") &&
        !source.includes("listUncertainSendJobs(20)") &&
        !source.includes("发送不确定风险概览")
      )
    },
  },
  {
    name: "pages render backend-offline error states",
    run: () =>
      [
        "app/page.tsx",
        "app/messages/page.tsx",
        "app/pending/page.tsx",
        "app/customers/page.tsx",
        "app/knowledge/page.tsx",
        "app/settings/page.tsx",
      ].every((file) => read(file).includes("ErrorState")),
  },
  {
    name: "pending page shows risk records and uncertain send queues",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("listReplyJobs") &&
        source.includes("listUncertainSendJobs") &&
        source.includes("listSendAttempts") &&
        source.includes("isReviewRiskReplyJob") &&
        source.includes("ReplyRiskSummary") &&
        source.includes("ReplyCardHeader") &&
        source.includes("reason_codes") &&
        source.includes("formatConversationLabel") &&
        source.includes("resolveSendJob") &&
        source.includes("unpauseConversation") &&
        source.includes("unpause_conversation") &&
        !source.includes("approveReplyJob") &&
        !source.includes("cancelReplyJob") &&
        !source.includes("send_after_approve") &&
        !source.includes("批准并发送") &&
        source.includes("确认已发") &&
        source.includes("确认并恢复") &&
        source.includes("标记失败") &&
        source.includes("updateConversationControl") &&
        source.includes("SEND_UNCERTAIN") &&
        !source.includes("sendConversationReply")
      )
    },
  },
  {
    name: "pending page filters uncertain send queue locally",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("SendUncertainFilter") &&
        source.includes("filteredSendJobs") &&
        source.includes("sendFilterQuery") &&
        source.includes("listUncertainSendJobs(50, sendFilterQuery") &&
        source.includes("全部") &&
        source.includes("仅未确认") &&
        source.includes("仅有错误码") &&
        source.includes("仅有截图证据") &&
        source.includes("hasSendAttemptErrorCode") &&
        source.includes("hasScreenshotEvidence")
      )
    },
  },
  {
    name: "pending page renders recent send error logs panel",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("RecentErrorLogsPanel") &&
        source.includes("apiClient.getRecentLogs(5") &&
        source.includes("only_errors: true") &&
        source.includes("最近错误日志") &&
        source.includes("event_type") &&
        source.includes("reason_code") &&
        source.includes("trace_id")
      )
    },
  },
  {
    name: "pending page renders send attempts evidence",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("SendAttemptList") &&
        source.includes("send_attempts") &&
        source.includes("attempt_no") &&
        source.includes("error_code") &&
        source.includes("before_screenshot") &&
        source.includes("after_screenshot") &&
        source.includes("无截图证据") &&
        source.includes("EvidenceRows")
      )
    },
  },
  {
    name: "pending page renders manual send resolution audit",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("SendResolutionAudit") &&
        source.includes("reviewed_by") &&
        source.includes("resolved_at") &&
        source.includes("resolution_note") &&
        source.includes("此页面不会自动重发")
      )
    },
  },
  {
    name: "pending page renders send confirmation evidence fields",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("formatConfirmationEvidence") &&
        source.includes("reason") &&
        source.includes("resolution") &&
        source.includes("visible_messages") &&
        source.includes("matched_text") &&
        source.includes("before_screenshot") &&
        source.includes("after_screenshot")
      )
    },
  },
  {
    name: "pending page sends manual send resolution audit fields",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("manual_confirmed") &&
        source.includes("manual_failed") &&
        countOccurrences(source, 'reviewed_by: "operator"') >= 1
      )
    },
  },
  {
    name: "pending page hides technical reply review audit block",
    run: () => {
      const source = read("app/pending/page.tsx")
      return !source.includes("ReplyReviewAudit") && !source.includes("审核人")
    },
  },
  {
    name: "pending page localizes review risk reasons and send outcomes",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("RISK_LEVEL_CATALOG") &&
        source.includes("REASON_CODE_CATALOG") &&
        source.includes("SEND_STATUS_CATALOG") &&
        source.includes("高风险") &&
        source.includes("提示词注入风险") &&
        source.includes("知识库证据未通过可信校验") &&
        source.includes("发送后未确认") &&
        source.includes("建议操作") &&
        source.includes("保留原码") &&
        source.includes("formatSendStatus") &&
        source.includes("formatSendErrorCode")
      )
    },
  },
  {
    name: "pending page omits duplicate send uncertain risk overview",
    run: () => {
      const source = read("app/pending/page.tsx")
      return !source.includes("getSendUncertainMetrics") && !source.includes("SendUncertainRiskOverview")
    },
  },
  {
    name: "messages page is record-only without send actions",
    run: () => {
      const source = read("app/messages/page.tsx")
      return (
        source.includes("messagesScrollRef") &&
        source.includes("scrollTop = scrollArea.scrollHeight") &&
        source.includes("RecordSummaryPanel") &&
        source.includes("overflow-y-auto") &&
        !source.includes("CONVERSATION_PAGE_SIZE") &&
        !source.includes("上一页") &&
        !source.includes("下一页") &&
        !source.includes("桌面端仅查看记录，不在此页发送消息") &&
        !source.includes("slice(-8)") &&
        !source.includes("sendConversationReply") &&
        !source.includes("suggestReply") &&
        !source.includes("window.confirm")
      )
    },
  },
  {
    name: "knowledge page supports local import and web build actions",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      return (
        source.includes("selectKnowledgeFiles") &&
        source.includes("getPathForFile") &&
        source.includes("apiClient.uploadKnowledgeFiles(files)") &&
        source.includes("importKnowledgeFiles") &&
        read("lib/api.ts").includes('"/knowledge/upload"') &&
        source.includes("buildWebKnowledgeFromDocuments")
      )
    },
  },
  {
    name: "desktop shell exposes knowledge file picker bridge",
    run: () => {
      const mainSource = read("../electron/main.cjs")
      const preloadSource = read("../electron/preload.cjs")
      const shellSource = read("lib/electron-shell.ts")
      return (
        mainSource.includes('dialog.showOpenDialog') &&
        mainSource.includes('"knowledge:select-files"') &&
        mainSource.includes("multiSelections") &&
        mainSource.includes("txt") &&
        mainSource.includes("markdown") &&
        mainSource.includes("docx") &&
        mainSource.includes("pdf") &&
        preloadSource.includes('"electronShell"') &&
        preloadSource.includes("selectKnowledgeFiles") &&
        preloadSource.includes("getPathForFile") &&
        preloadSource.includes("webUtils.getPathForFile") &&
        preloadSource.includes('"knowledge:select-files"') &&
        shellSource.includes("electronShell?: ElectronShellApi") &&
        shellSource.includes("selectKnowledgeFiles") &&
        shellSource.includes("getPathForFile") &&
        shellSource.includes("Promise<string[]>") &&
        shellSource.includes("return []")
      )
    },
  },
  {
    name: "knowledge page shows embedding provider trust status",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("embedding_provider") &&
        source.includes("embedding_trusted") &&
        source.includes("embedding_trust_status") &&
        source.includes("fake_embedding_provider") &&
        source.includes("untrusted") &&
        apiSource.includes("embedding_trust_status")
      )
    },
  },
  {
    name: "knowledge page renders search evidence fields",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("retrieval_sources") &&
        source.includes("match_terms") &&
        source.includes("dense_score") &&
        source.includes("keyword_score") &&
        source.includes("doc_id") &&
        source.includes("source") &&
        apiSource.includes("evidence") &&
        apiSource.includes("metadata") &&
        apiSource.includes("retrieval_sources")
      )
    },
  },
  {
    name: "knowledge page renders readable search result dialog",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      return (
        source.includes("apiClient.searchKnowledge(keyword, 5)") &&
        source.includes("SearchResultCard") &&
        source.includes("formatSearchResultSource") &&
        source.includes("内容片段") &&
        source.includes("来源") &&
        source.includes("相关度") &&
        source.includes("暂无匹配片段") &&
        source.includes("检索出错") &&
        source.includes("overflow-y-auto")
      )
    },
  },
  {
    name: "knowledge page renders backend recent tasks",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("listKnowledgeTasks") &&
        source.includes("buildKnowledgeAcceptanceReport") &&
        source.includes("formatKnowledgeTaskType") &&
        source.includes("formatKnowledgeTaskStatus") &&
        source.includes("formatKnowledgeTaskStage") &&
        source.includes("ai_normalize") &&
        source.includes("AcceptanceReportDialog") &&
        !source.includes("importResult") &&
        !source.includes("webResult") &&
        apiSource.includes('"/knowledge/tasks"') &&
        apiSource.includes('"/knowledge/ai-normalize-preview"') &&
        apiSource.includes('"/knowledge/ai-normalize-confirm"') &&
        apiSource.includes('"/knowledge/acceptance-report"')
      )
    },
  },
  {
    name: "knowledge API client keeps trust diagnostics available without a persistent page gate",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        !source.includes("KnowledgeTrustGate") &&
        apiSource.includes('"/knowledge/trust-diagnostics"') &&
        apiSource.includes('"/knowledge/trusted-rebuild"') &&
        apiSource.includes("KnowledgeTrustDiagnostics") &&
        apiSource.includes("KnowledgeTrustedRebuildResult")
      )
    },
  },
  {
    name: "home page preflights environment before real auto reply start",
    run: () => {
      const source = read("app/page.tsx")
      return (
        source.includes("bootstrapCheckRuntime") &&
        source.includes("bootstrapStartRuntime") &&
        read("lib/api.ts").includes('"/runtime/bootstrap-start"') &&
        read("lib/api.ts").includes("BOOTSTRAP_READY_TIMEOUT_SECONDS = 120") &&
        source.includes("result.data.bootstrap?.ui_ready") &&
        source.indexOf("bootstrapCheckRuntime") < source.indexOf("bootstrapStartRuntime") &&
        !source.includes("apiClient.getWechatEnvironment(),")
      )
    },
  },
  {
    name: "settings page exposes desktop shell preferences",
    run: () => {
      const source = read("app/settings/page.tsx")
      const shellSource = read("lib/electron-shell.ts")
      return (
        source.includes("开机自启") &&
        source.includes("定时巡检间隔") &&
        source.includes("launchAtLogin") &&
        source.includes("scheduleTickIntervalSeconds") &&
        shellSource.includes("getDesktopShellBridge") &&
        shellSource.includes("updatePreferences")
      )
    },
  },
  {
    name: "settings page exposes controlled safety rule groups and reset",
    run: () => {
      const source = read("app/settings/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("safetyRuleGroups") &&
        source.includes("prompt_injection") &&
        source.includes("sensitive_information") &&
        source.includes("business_risk") &&
        source.includes("restoreDefaultSafetyPolicy") &&
        apiSource.includes("SafetyPolicyPatch") &&
        apiSource.includes("rule_groups")
      )
    },
  },
  {
    name: "settings page hides safety policy audit trail",
    run: () => {
      const source = read("app/settings/page.tsx")
      return (
        !source.includes("getSafetyPolicyAudit") &&
        !source.includes("SafetyPolicyAuditTrail") &&
        !source.includes("changed_rule_groups")
      )
    },
  },
  {
    name: "settings page supports localized safety policy import export recovery",
    run: () => {
      const source = read("app/settings/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("SafetyPolicyImportExportPanel") &&
        source.includes("exportSafetyPolicy") &&
        source.includes("importSafetyPolicy") &&
        source.includes("restoreDefaultSafetyPolicy") &&
        source.includes("安全策略备份") &&
        source.includes("导出配置") &&
        source.includes("导入配置") &&
        source.includes("DialogContent") &&
        source.includes("JSON.parse") &&
        apiSource.includes("SafetyPolicyImportBody") &&
        apiSource.includes('"/settings/safety-policy/export"') &&
        apiSource.includes('"/settings/safety-policy/import"') &&
        apiSource.includes('"/settings/safety-policy/restore-defaults"')
      )
    },
  },
  {
    name: "pending page hides technical reply send result block",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        !source.includes("ReplySendResult") &&
        !source.includes("reply_send_result") &&
        !source.includes("发送任务 ID")
      )
    },
  },
]

const failures = checks.filter((check) => !check.run())

if (failures.length) {
  console.error("P5 frontend acceptance failed:")
  for (const failure of failures) {
    console.error(`- ${failure.name}`)
  }
  process.exit(1)
}

console.log(`P5 frontend acceptance passed: ${checks.length}/${checks.length} checks`)

function read(file) {
  return readFileSync(join(root, file), "utf8")
}

function countOccurrences(source, token) {
  return source.split(token).length - 1
}
