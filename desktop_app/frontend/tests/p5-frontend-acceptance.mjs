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
        "sendConversationReply",
        "listReplyJobs",
        "approveReplyJob",
        "cancelReplyJob",
        "listSendJobs",
        "listSendAttempts",
        "resolveSendJob",
        "listUncertainSendJobs",
        "getSendUncertainMetrics",
        "SendUncertainMetrics",
        "listCustomers",
        "updateGlobalSelfIdentity",
        "getKnowledgeStatus",
        "searchKnowledge",
        "importKnowledgeFiles",
        "buildWebKnowledgeFromDocuments",
        "getKnowledgeAcceptanceHistory",
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
    name: "home page renders send uncertain risk overview",
    run: () => {
      const source = read("app/page.tsx")
      return (
        source.includes("getSendUncertainMetrics") &&
        source.includes("SendUncertainRiskOverview") &&
        source.includes("top_error_codes") &&
        source.includes("top_conversations") &&
        source.includes("SEND_UNCERTAIN") &&
        !source.includes("自动重发")
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
    name: "pending page shows reply review and uncertain send queues",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("listReplyJobs") &&
        source.includes("listUncertainSendJobs") &&
        source.includes("listSendAttempts") &&
        source.includes("approveReplyJob") &&
        source.includes("cancelReplyJob") &&
        source.includes("approve_send") &&
        source.includes("send_after_approve") &&
        source.includes("ReplyRiskSummary") &&
        source.includes("reason_codes") &&
        source.includes("formatReasonCode") &&
        source.includes("resolveSendJob") &&
        source.includes("unpauseConversation") &&
        source.includes("unpause_conversation") &&
        source.includes("批准") &&
        source.includes("取消") &&
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
    name: "pending page sends manual reviewer audit fields",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("manual_approve") &&
        source.includes("manual_approve_and_send") &&
        source.includes('reason: "manual_cancel"') &&
        countOccurrences(source, 'reviewed_by: "operator"') >= 3
      )
    },
  },
  {
    name: "pending page renders reply review audit fields",
    run: () => {
      const source = read("app/pending/page.tsx")
      return source.includes("reviewed_by") && source.includes("reviewed_at") && source.includes("review_reason")
    },
  },
  {
    name: "home page loads uncertain send job overview",
    run: () => {
      const source = read("app/page.tsx")
      return source.includes("listUncertainSendJobs(20)") && source.includes("uncertainSendJobs")
    },
  },
  {
    name: "dangerous message send requires confirmation",
    run: () => read("app/messages/page.tsx").includes("window.confirm"),
  },
  {
    name: "knowledge page supports local import and web build actions",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      return source.includes("importKnowledgeFiles") && source.includes("buildWebKnowledgeFromDocuments")
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
    name: "knowledge page renders acceptance history panel",
    run: () => {
      const source = read("app/knowledge/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("AcceptanceHistoryPanel") &&
        source.includes("acceptanceHistory") &&
        source.includes("getKnowledgeAcceptanceHistory") &&
        source.includes("knowledge_trust_status") &&
        source.includes("retrieved_chunk_ids") &&
        source.includes("imported_files") &&
        !source.includes("history.retrieved_chunks") &&
        apiSource.includes('"/debug/knowledge-acceptance/history"')
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
        source.includes("reset_to_defaults") &&
        apiSource.includes("SafetyPolicyPatch") &&
        apiSource.includes("rule_groups")
      )
    },
  },
  {
    name: "settings page renders safety policy audit trail",
    run: () => {
      const source = read("app/settings/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("getSafetyPolicyAudit") &&
        source.includes("SafetyPolicyAuditTrail") &&
        source.includes("changed_rule_groups") &&
        source.includes("reset_to_defaults") &&
        source.includes("operator") &&
        source.includes("source") &&
        apiSource.includes("SafetyPolicyAuditRecord") &&
        apiSource.includes('"/settings/safety-policy/audit"')
      )
    },
  },
  {
    name: "settings page supports safety policy import export recovery",
    run: () => {
      const source = read("app/settings/page.tsx")
      const apiSource = read("lib/api.ts")
      return (
        source.includes("SafetyPolicyImportExportPanel") &&
        source.includes("exportSafetyPolicy") &&
        source.includes("importSafetyPolicy") &&
        source.includes("restoreDefaultSafetyPolicy") &&
        source.includes("Safety Policy Import / Export") &&
        source.includes("JSON.parse") &&
        apiSource.includes("SafetyPolicyImportBody") &&
        apiSource.includes('"/settings/safety-policy/export"') &&
        apiSource.includes('"/settings/safety-policy/import"') &&
        apiSource.includes('"/settings/safety-policy/restore-defaults"')
      )
    },
  },
  {
    name: "pending page renders approve send result feedback",
    run: () => {
      const source = read("app/pending/page.tsx")
      return (
        source.includes("ReplySendResult") &&
        source.includes("approve_send_result") &&
        source.includes("send_status") &&
        source.includes("send_result") &&
        source.includes("send_job_id") &&
        source.includes("confirmed")
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
