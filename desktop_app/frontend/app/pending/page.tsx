"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { toast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import type { ConversationControlPatch, RecentLogEvent, ReplyJob, SendAttempt, SendJob, SendJobListFilters } from "@/lib/api"
import { AlertTriangle, Bot, CheckCircle2, Hand, Pause, RefreshCw, ShieldAlert, X } from "lucide-react"

type ActionTarget = {
  conversationId: string
  action: "takeover" | "pause"
}

type SendActionTarget = {
  sendJobId: string
  resolution: "confirmed" | "failed"
  unpauseConversation?: boolean
}

type SendUncertainFilter = "all" | "unconfirmed" | "error_code" | "screenshot"

const SEND_FILTERS: Array<{ value: SendUncertainFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unconfirmed", label: "仅未确认" },
  { value: "error_code", label: "仅有错误码" },
  { value: "screenshot", label: "仅有截图证据" },
]

type RiskLevel = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN"

type ReasonCatalogItem = {
  label: string
  description: string
  action?: string
}

const RISK_LEVEL_CATALOG: Record<RiskLevel, ReasonCatalogItem> = {
  HIGH: { label: "高风险", description: "需要人工重点审核，确认后再放行。" },
  MEDIUM: { label: "中风险", description: "建议人工复核，确认语义和依据可靠。" },
  LOW: { label: "低风险", description: "风险较低，但仍可按需抽查。" },
  UNKNOWN: { label: "未知风险", description: "后端未返回明确风险等级，请结合原因和上下文判断。" },
}

const REASON_CODE_CATALOG: Record<string, ReasonCatalogItem> = {
  PROMPT_INJECTION: {
    label: "提示词注入风险",
    description: "用户消息可能试图绕过系统规则、泄露配置或改变助手行为。",
    action: "建议操作：不要直接照做，确认回复未泄露系统信息。",
  },
  SENSITIVE_INFORMATION: {
    label: "敏感信息风险",
    description: "内容可能包含隐私、账号、联系方式、财务或其他敏感信息。",
    action: "建议操作：脱敏后再回复，必要时转人工。",
  },
  HIGH_RISK_INTENT: {
    label: "高风险意图",
    description: "用户意图可能涉及违规、危险、承诺过重或需要人工判断的事项。",
    action: "建议操作：人工确认边界，避免给出不当承诺或指导。",
  },
  HIGH_RISK_COMMITMENT: {
    label: "高风险承诺",
    description: "草稿回复可能承诺价格、售后、时效、合同或其他关键责任。",
    action: "建议操作：核对真实政策和授权后再发送。",
  },
  UNTRUSTED_KNOWLEDGE_CONTEXT: {
    label: "知识库证据未通过可信校验",
    description: "回复依赖的知识库上下文来源或嵌入可信度不足。",
    action: "建议操作：先核对原始资料，必要时重建可信知识库。",
  },
  UNRESOLVED_SEND_UNCERTAIN: {
    label: "已有未确认发送",
    description: "当前会话已有发送结果未确认，为避免重复发送，后续回复已拦截并等待人工检查。",
    action: "建议操作：先核对微信窗口，将上一条记录标记为已发或失败，再恢复会话。",
  },
  UNTRUSTED_FAKE_EMBEDDINGS: {
    label: "知识库仍是测试向量",
    description: "本地知识库仍使用测试向量，真实发送前会被拦截，避免模型引用不可靠资料。",
    action: "建议操作：配置真实向量模型并重建知识库，或转人工核对。",
  },
  UNTRUSTED_KNOWLEDGE_EMBEDDINGS: {
    label: "知识库向量未声明可信",
    description: "本地知识库向量来源未通过可信校验，真实发送前会被拦截。",
    action: "建议操作：重建可信知识库，确认资料来源后再恢复自动回复。",
  },
  SEND_UNCERTAIN: {
    label: "发送结果不确定",
    description: "发送动作已触发，但系统无法确认微信窗口中是否真实出现消息。",
    action: "建议操作：人工查看微信窗口后标记已发或失败。",
  },
  SEND_FAILED: {
    label: "发送失败",
    description: "真实发送器执行失败，消息可能没有发出。",
    action: "建议操作：检查错误详情和微信状态，必要时人工补发。",
  },
  SEND_NOT_CONFIRMED: {
    label: "发送后未确认",
    description: "发送后未能通过窗口侧证据确认消息出现。",
    action: "建议操作：人工核对聊天窗口，确认后再解除待处理。",
  },
  EMPTY_TEXT: {
    label: "回复内容为空",
    description: "发送前校验发现待发送文本为空。",
    action: "建议操作：补充回复内容或取消任务。",
  },
  HUMAN_TAKEOVER: {
    label: "会话已人工接管",
    description: "当前会话已交给人工处理，自动发送被拦截。",
    action: "建议操作：由人工继续处理，或确认后取消接管。",
  },
  CONVERSATION_PAUSED: {
    label: "会话已暂停",
    description: "当前会话暂停自动回复，发送被拦截。",
    action: "建议操作：确认需要恢复后再继续自动发送。",
  },
  BLACKLISTED: {
    label: "会话在黑名单中",
    description: "当前会话被黑名单策略拦截。",
    action: "建议操作：核对黑名单设置后再决定是否放行。",
  },
}

const SEND_STATUS_CATALOG: Record<string, string> = {
  sent: "已发送",
  blocked: "已拦截",
  failed: "发送失败",
  unconfirmed: "发送后未确认",
  not_implemented: "真实发送器未启用",
  pending: "待处理",
  SEND_BLOCKED: "发送前已拦截",
  BLOCKED: "已拦截",
  SEND_UNCERTAIN: "发送结果不确定",
  UNCERTAIN: "发送结果不确定",
}

const REVIEW_REASON_CATALOG: Record<string, string> = {
  manual_confirmed: "人工确认已发送",
  manual_failed: "人工标记失败",
  blocked_before_send: "发送前拦截",
  send_reply: "手动发送",
  approve_reply_job: "审核后发送",
}

export default function PendingPage() {
  const [replyJobs, setReplyJobs] = useState<ReplyJob[]>([])
  const [sendJobs, setSendJobs] = useState<SendJob[]>([])
  const [attemptsBySendJob, setAttemptsBySendJob] = useState<Record<string, SendAttempt[]>>({})
  const [recentErrorLogs, setRecentErrorLogs] = useState<RecentLogEvent[]>([])
  const [sendFilter, setSendFilter] = useState<SendUncertainFilter>("all")
  const [sendConversationFilter, setSendConversationFilter] = useState("")
  const [sendErrorCodeFilter, setSendErrorCodeFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [busyTarget, setBusyTarget] = useState("")

  const sendFilterQuery = useMemo<SendJobListFilters>(
    () => ({
      unresolved: true,
      conversation_id: sendConversationFilter.trim() || undefined,
      error_code: sendErrorCodeFilter.trim() || undefined,
    }),
    [sendConversationFilter, sendErrorCodeFilter],
  )

  async function loadPending({ quiet = false } = {}) {
    if (quiet) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError("")
    try {
      const [replies, uncertainSends, recentLogs] = await Promise.all([
        apiClient.listReplyJobs(undefined, 50),
        apiClient.listUncertainSendJobs(100, sendFilterQuery),
        apiClient.getRecentLogs(5, { only_errors: true }),
      ])
      if (!replies.success || !replies.data) {
        setError(replies.error ? `${replies.error.code}: ${replies.error.message}` : "待审核回复加载失败")
        return
      }
      if (!uncertainSends.success || !uncertainSends.data) {
        setError(uncertainSends.error ? `${uncertainSends.error.code}: ${uncertainSends.error.message}` : "发送异常列表加载失败")
        return
      }
      setReplyJobs(replies.data)
      setSendJobs(uncertainSends.data)
      setRecentErrorLogs(recentLogs.success && recentLogs.data ? recentLogs.data : [])

      const attemptPairs = await Promise.all(
        uncertainSends.data.map(async (job) => {
          const attempts = await apiClient.listSendAttempts(job.send_job_id, 10)
          return [job.send_job_id, attempts.success && attempts.data ? attempts.data : []] as const
        }),
      )
      setAttemptsBySendJob(Object.fromEntries(attemptPairs))
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接本地后端服务")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    void loadPending()
  }, [sendFilterQuery])

  const filteredSendJobs = useMemo(
    () =>
      sendJobs.filter((job) => {
        const attempts = attemptsBySendJob[job.send_job_id] ?? []
        if (sendFilter === "unconfirmed") return isUnconfirmedSendJob(job)
        if (sendFilter === "error_code") return hasSendAttemptErrorCode(attempts)
        if (sendFilter === "screenshot") return hasScreenshotEvidence(job, attempts)
        return true
      }),
    [attemptsBySendJob, sendFilter, sendJobs],
  )
  const reviewReplyJobs = useMemo(
    () => replyJobs.filter((job) => isReviewRiskReplyJob(job)),
    [replyJobs],
  )

  const stats = useMemo(
    () => [
      { label: "待审核回复", value: reviewReplyJobs.length, tone: "text-blue-600" },
      { label: "发送不确定", value: sendJobs.length, tone: "text-rose-600" },
      { label: "人工检查", value: reviewReplyJobs.length + sendJobs.length, tone: "text-amber-600" },
    ],
    [reviewReplyJobs.length, sendJobs.length],
  )

  async function updateControl({ conversationId, action }: ActionTarget) {
    const patchBody: ConversationControlPatch = action === "takeover" ? { human_takeover: true } : { paused: true }
    setBusyTarget(`${action}:${conversationId}`)
    setError("")
    try {
      const response = await apiClient.updateConversationControl(conversationId, patchBody)
      if (!response.success || !response.data) {
        toast({
          title: "会话控制更新失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      toast({
        title: action === "takeover" ? "已标记为人工接管" : "会话已暂停",
        description: conversationId,
        duration: 1800,
      })
    } catch (err) {
      toast({
        title: "会话控制更新失败",
        description: err instanceof Error ? err.message : "无法更新会话控制",
        variant: "destructive",
        duration: 1800,
      })
    } finally {
      setBusyTarget("")
    }
  }

  async function resolveSendJob({ sendJobId, resolution, unpauseConversation = false }: SendActionTarget) {
    const targetKey = `send:${resolution}:${unpauseConversation ? "unpause" : "keep"}:${sendJobId}`
    setBusyTarget(targetKey)
    setError("")
    try {
      const response = await apiClient.resolveSendJob(sendJobId, {
        resolution,
        reason: resolution === "confirmed" ? "manual_confirmed" : "manual_failed",
        reviewed_by: "operator",
        unpause_conversation: unpauseConversation,
      })
      if (!response.success) {
        toast({
          title: "发送异常处理失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      await loadPending({ quiet: true })
      toast({
        title: resolution === "confirmed" ? "已确认发送状态" : "已标记发送失败",
        description: unpauseConversation ? "会话已恢复" : sendJobId,
        duration: 1800,
      })
    } catch (err) {
      toast({
        title: "发送异常处理失败",
        description: err instanceof Error ? err.message : "无法更新 SendJob",
        variant: "destructive",
        duration: 1800,
      })
    } finally {
      setBusyTarget("")
    }
  }

  return (
    <AppShell
      title="待处理"
      headerRight={
        <button
          disabled={loading || refreshing}
          onClick={() => void loadPending({ quiet: true })}
          className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          刷新
        </button>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--app-content-bg)] p-4">
        <div className="mb-3 grid grid-cols-3 gap-3">
          {stats.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">{item.label}</div>
              <div className={`mt-1 text-xl font-semibold tabular-nums ${item.tone}`}>{item.value}</div>
            </div>
          ))}
        </div>

        {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}

        {loading ? (
          <LoadingState label="正在加载待处理事项" />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
            <QueuePanel
              title="待审核回复"
              subtitle="中高风险"
              icon={<Bot className="h-4 w-4 text-blue-500" />}
              emptyTitle="暂无中高风险待审核回复"
            >
              {reviewReplyJobs.map((job) => (
                <ReplyJobCard
                  key={job.reply_job_id}
                  job={job}
                  busyTarget={busyTarget}
                  onControl={updateControl}
                />
              ))}
            </QueuePanel>

            <QueuePanel
              title="发送异常"
              subtitle="发送不确定"
              icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
              emptyTitle="暂无发送不确定记录"
              headerExtra={
                <SendFilterControls
                  value={sendFilter}
                  conversationId={sendConversationFilter}
                  errorCode={sendErrorCodeFilter}
                  onChange={setSendFilter}
                  onConversationIdChange={setSendConversationFilter}
                  onErrorCodeChange={setSendErrorCodeFilter}
                />
              }
            >
              <RecentErrorLogsPanel logs={recentErrorLogs} />
              {filteredSendJobs.map((job) => (
                <SendJobCard
                  key={job.send_job_id}
                  job={job}
                  attempts={attemptsBySendJob[job.send_job_id] ?? []}
                  busyTarget={busyTarget}
                  onControl={updateControl}
                  onResolve={resolveSendJob}
                />
              ))}
            </QueuePanel>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function QueuePanel({
  title,
  subtitle,
  icon,
  emptyTitle,
  headerExtra,
  children,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  emptyTitle: string
  headerExtra?: ReactNode
  children: ReactNode
}) {
  const childArray = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : []
  const hasChildren = childArray.length > 0
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
          </div>
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{subtitle}</span>
        </div>
        {headerExtra ? <div className="mt-3">{headerExtra}</div> : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {hasChildren ? children : <EmptyState title={emptyTitle}>当前队列已经清空。</EmptyState>}
      </div>
    </section>
  )
}

function SendFilterControls({
  value,
  conversationId,
  errorCode,
  onChange,
  onConversationIdChange,
  onErrorCodeChange,
}: {
  value: SendUncertainFilter
  conversationId: string
  errorCode: string
  onChange: (value: SendUncertainFilter) => void
  onConversationIdChange: (value: string) => void
  onErrorCodeChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <SendFilterTabs value={value} onChange={onChange} />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={conversationId}
          onChange={(event) => onConversationIdChange(event.target.value)}
          placeholder="会话 ID"
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-300"
        />
        <input
          value={errorCode}
          onChange={(event) => onErrorCodeChange(event.target.value)}
          placeholder="错误码"
          className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-sky-300"
        />
      </div>
    </div>
  )
}

function SendFilterTabs({
  value,
  onChange,
}: {
  value: SendUncertainFilter
  onChange: (value: SendUncertainFilter) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
      {SEND_FILTERS.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={`h-8 rounded-md px-2 text-xs font-semibold transition ${
            value === item.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function RecentErrorLogsPanel({ logs }: { logs: RecentLogEvent[] }) {
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        最近错误日志
      </div>
      {logs.length ? (
        <div className="space-y-2">
          {logs.map((log, index) => (
            <div key={`${log.trace_id ?? "trace"}:${log.event_type ?? "event"}:${index}`} className="rounded border border-amber-100 bg-white px-2 py-2">
              <MetaRow label="事件类型" value={stringify(log.event_type)} />
              <MetaRow label="原因码" value={formatSendErrorCode(log.reason_code)} />
              <MetaRow label="追踪 ID" value={stringify(log.trace_id)} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-amber-700">暂无最近错误日志。</div>
      )}
    </div>
  )
}

function ReplyJobCard({
  job,
  busyTarget,
  onControl,
}: {
  job: ReplyJob
  busyTarget: string
  onControl: (target: ActionTarget) => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <ReplyCardHeader time={job.updated_at ?? job.created_at} />
      <ReplyRiskSummary job={job} />
      <MetaRow label="会话" value={formatConversationLabel(job.conversation_id)} />
      <ReplyKnowledgeEvidence job={job} />
      <TextBlock label="触发消息" value={job.input_text} />
      <TextBlock label="草稿回复" value={job.draft_reply || "暂无草稿内容"} strong />
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
}

function ReplyRiskSummary({ job }: { job: ReplyJob }) {
  const riskLevel = normalizeRiskLevel(job.risk_level)
  const risk = RISK_LEVEL_CATALOG[riskLevel]
  const reasonCodes = normalizeReasonCodes(job.reason_codes)
  const riskClass = riskLevel === "HIGH"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : riskLevel === "MEDIUM"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : riskLevel === "UNKNOWN"
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700"

  return (
    <div className="mt-2 rounded-md bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">风险等级</span>
        <span className={`rounded border px-2 py-0.5 font-semibold ${riskClass}`}>{risk.label}</span>
      </div>
      <div className="mb-2 text-xs leading-relaxed text-slate-500">{risk.description}</div>
      <div className="space-y-2">
        {reasonCodes.length ? reasonCodes.map((code) => (
          <ReasonCodeCard key={code} code={code} />
        )) : (
          <span className="text-xs text-slate-400">暂无风险原因</span>
        )}
      </div>
    </div>
  )
}

function ReasonCodeCard({ code }: { code: string }) {
  const reason = getReasonCodeDetail(code)
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-700">{reason.label}</span>
      </div>
      <div className="mt-1 leading-relaxed text-slate-500">{reason.description}</div>
      {reason.action ? <div className="mt-1 leading-relaxed text-amber-700">{reason.action}</div> : null}
    </div>
  )
}

function ReplyKnowledgeEvidence({ job }: { job: ReplyJob }) {
  const evidence = Array.isArray(job.metadata?.knowledge_evidence) ? job.metadata.knowledge_evidence : []
  if (!evidence.length) return null

  return (
    <div className="mt-2 rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-emerald-700">参考知识片段</span>
        <span className="rounded bg-white px-2 py-0.5 font-semibold text-emerald-700">{evidence.length} 条</span>
      </div>
      <div className="space-y-2">
        {evidence.map((item, index) => (
          <div key={`${item.doc_id || item.source || "knowledge"}:${item.chunk_index || index}`} className="rounded border border-emerald-100 bg-white px-2 py-2 text-xs">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-700">{item.source || item.doc_id || "未知来源"}</span>
              {item.chunk_index ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">片段 {item.chunk_index}</span> : null}
              {item.knowledge_trust_status ? (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                  {formatKnowledgeTrustStatus(item.knowledge_trust_status)}
                </span>
              ) : null}
            </div>
            {item.text ? <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-600">{item.text}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-slate-400">
              {item.doc_id ? <span>文档 ID：{item.doc_id}</span> : null}
              {typeof item.score === "number" ? <span>score: {item.score.toFixed(3)}</span> : null}
              {item.knowledge_trust_reason ? <span>{item.knowledge_trust_reason}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SendJobCard({
  job,
  attempts,
  busyTarget,
  onControl,
  onResolve,
}: {
  job: SendJob
  attempts: SendAttempt[]
  busyTarget: string
  onControl: (target: ActionTarget) => void
  onResolve: (target: SendActionTarget) => void
}) {
  const evidence = formatConfirmationEvidence(job)
  const screenshotRows = collectScreenshotEvidence(job)

  return (
    <article className="rounded-lg border border-rose-100 bg-rose-50/40 p-4">
      <JobHeader id={job.send_job_id} status={job.status} time={job.updated_at ?? job.created_at} danger />
      <MetaRow label="会话" value={job.target_title || job.conversation_id} />
      <MetaRow label="确认结果" value={evidence.summary} />
      {evidence.fields.length ? (
        <div className="mt-2 rounded-md bg-white px-3 py-2">
          {evidence.fields.map((item) =>
            item.multiline ? (
              <TextBlock key={item.key} label={item.label} value={item.value} />
            ) : (
              <MetaRow key={item.key} label={item.label} value={item.value} />
            ),
          )}
        </div>
      ) : null}
      <SendResolutionAudit job={job} />
      <EvidenceRows rows={screenshotRows} />
      <TextBlock label="发送内容" value={job.content} strong />
      <SendAttemptList attempts={attempts} />
      <div className="mt-3 flex items-start gap-2 rounded-md bg-white px-3 py-2 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>此页面不会自动重发消息。请先人工核对微信窗口中的真实发送状态。</span>
      </div>
      <SendJobActions job={job} busyTarget={busyTarget} onResolve={onResolve} />
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
}

function SendAttemptList({ attempts }: { attempts: SendAttempt[] }) {
  if (!attempts.length) return null
  const sourceKey = "send_attempts"
  return (
    <div className="mt-3 rounded-md bg-white px-3 py-2" data-source={sourceKey}>
      <div className="mb-2 text-xs font-semibold text-slate-500">发送记录（{attempts.length} 条）</div>
      <div className="space-y-2">
        {attempts.map((attempt) => (
          <div key={attempt.attempt_id} className="rounded border border-slate-100 bg-slate-50 px-2 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                第 {attempt.attempt_no} 次：{formatSendStatus(attempt.status)}
              </span>
              <span className="text-slate-400">{formatDate(attempt.finished_at ?? attempt.started_at)}</span>
            </div>
            {attempt.error_code ? <MetaRow label="错误码" value={formatSendErrorCode(attempt.error_code)} /> : null}
            {attempt.error_message ? <MetaRow label="错误说明" value={attempt.error_message} /> : null}
            <EvidenceRows rows={collectAttemptScreenshotEvidence(attempt)} compact />
          </div>
        ))}
      </div>
    </div>
  )
}

function SendResolutionAudit({ job }: { job: SendJob }) {
  const result = isRecord(job.confirmation_result) ? job.confirmation_result : {}
  const reviewedBy = formatEvidenceValue(result.reviewed_by ?? result.operator)
  const resolvedAt = formatEvidenceValue(result.resolved_at)
  const resolutionNote = formatEvidenceValue(result.resolution_note ?? result.review_reason ?? result.reason)
  if (!reviewedBy && !resolvedAt && !resolutionNote) return null
  return (
    <div className="mt-3 rounded-md border border-sky-100 bg-sky-50/70 px-3 py-2">
      <div className="mb-2 text-xs font-semibold text-sky-700">处理历史</div>
      {reviewedBy ? <MetaRow label="处理人" value={reviewedBy} /> : null}
      {resolvedAt ? <MetaRow label="处理时间" value={formatDate(resolvedAt)} /> : null}
      {resolutionNote ? <MetaRow label="处理说明" value={formatReviewReason(resolutionNote)} /> : null}
    </div>
  )
}

function EvidenceRows({ rows, compact = false }: { rows: EvidenceRow[]; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-2" : "mt-3"} rounded-md bg-white px-3 py-2`}>
      <div className="mb-2 text-xs font-semibold text-slate-500">截图证据</div>
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="rounded border border-slate-100 bg-slate-50 px-2 py-2">
              <MetaRow label={row.label} value={row.path} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400">无截图证据</div>
      )}
    </div>
  )
}

function SendJobActions({
  job,
  busyTarget,
  onResolve,
}: {
  job: SendJob
  busyTarget: string
  onResolve: (target: SendActionTarget) => void
}) {
  const confirmedKey = `send:confirmed:keep:${job.send_job_id}`
  const confirmedRestoreKey = `send:confirmed:unpause:${job.send_job_id}`
  const failedKey = `send:failed:keep:${job.send_job_id}`
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      <button
        disabled={busyTarget === confirmedKey}
        onClick={() => onResolve({ sendJobId: job.send_job_id, resolution: "confirmed" })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {busyTarget === confirmedKey ? "处理中" : "确认已发"}
      </button>
      <button
        disabled={busyTarget === confirmedRestoreKey}
        onClick={() => onResolve({ sendJobId: job.send_job_id, resolution: "confirmed", unpauseConversation: true })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 text-xs font-medium text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {busyTarget === confirmedRestoreKey ? "处理中" : "确认并恢复"}
      </button>
      <button
        disabled={busyTarget === failedKey}
        onClick={() => onResolve({ sendJobId: job.send_job_id, resolution: "failed" })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <X className="h-3.5 w-3.5" />
        {busyTarget === failedKey ? "处理中" : "标记失败"}
      </button>
    </div>
  )
}

type ConfirmationEvidence = {
  summary: string
  fields: Array<{
    key: string
    label: string
    value: string
    multiline?: boolean
  }>
}

type EvidenceRow = {
  label: "before_screenshot" | "after_screenshot"
  path: string
}

function formatConfirmationEvidence(job: SendJob): ConfirmationEvidence {
  const value = job.confirmation_result
  const summary = formatConfirmationResult(value)
  if (!value || typeof value === "string") return { summary, fields: [] }

  const nested = isRecord(value.confirmation) ? value.confirmation : {}
  const source = {
    ...nested,
    ...value,
    before_screenshot: value.before_screenshot ?? nested.before_screenshot ?? job.before_screenshot,
    after_screenshot: value.after_screenshot ?? nested.after_screenshot ?? job.after_screenshot,
  }

  const fields = [
    evidenceField(source, "phase", "拦截阶段", false, formatReviewReason),
    evidenceField(source, "action", "来源动作", false),
    evidenceField(source, "reason", "原因说明", false, formatReviewReason),
    evidenceField(source, "reason_code", "原因码", false, formatSendErrorCode),
    evidenceField(source, "knowledge_trust_status", "知识库可信状态", false, formatKnowledgeTrustStatus),
    evidenceField(source, "embedding_provider", "向量来源", false),
    evidenceField(source, "resolution", "处理结果", false, formatReviewReason),
    evidenceField(source, "visible_messages", "visible_messages", true),
    evidenceField(source, "matched_text", "matched_text", true),
  ].filter((item): item is ConfirmationEvidence["fields"][number] => Boolean(item))

  return {
    summary: fields.length ? "已有发送证据，请人工核对" : summary,
    fields,
  }
}

function evidenceField(
  source: Record<string, unknown>,
  key: string,
  label: string,
  multiline = false,
  formatter: (value: unknown) => string = formatEvidenceValue,
): ConfirmationEvidence["fields"][number] | null {
  if (!(key in source)) return null
  const value = formatter(source[key])
  return value ? { key, label, value, multiline } : null
}

function collectScreenshotEvidence(job: SendJob): EvidenceRow[] {
  const value = isRecord(job.confirmation_result) ? job.confirmation_result : {}
  const nested = isRecord(value.confirmation) ? value.confirmation : {}
  return [
    screenshotRow("before_screenshot", value.before_screenshot ?? nested.before_screenshot ?? job.before_screenshot),
    screenshotRow("after_screenshot", value.after_screenshot ?? nested.after_screenshot ?? job.after_screenshot),
  ].filter((row): row is EvidenceRow => Boolean(row))
}

function collectAttemptScreenshotEvidence(attempt: SendAttempt): EvidenceRow[] {
  return [
    screenshotRow("before_screenshot", attempt.before_screenshot),
    screenshotRow("after_screenshot", attempt.after_screenshot),
  ].filter((row): row is EvidenceRow => Boolean(row))
}

function screenshotRow(label: EvidenceRow["label"], value: unknown): EvidenceRow | null {
  const path = formatEvidenceValue(value)
  return path ? { label, path } : null
}

function hasScreenshotEvidence(job: SendJob, attempts: SendAttempt[]) {
  return collectScreenshotEvidence(job).length > 0 || attempts.some((attempt) => collectAttemptScreenshotEvidence(attempt).length > 0)
}

function hasSendAttemptErrorCode(attempts: SendAttempt[]) {
  return attempts.some((attempt) => Boolean(attempt.error_code))
}

function isUnconfirmedSendJob(job: SendJob) {
  const status = String(job.status || "").toUpperCase()
  return status === "SEND_UNCERTAIN" || status === "UNCERTAIN" || status === "PENDING" || !job.confirmation_result
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map((item) => formatEvidenceValue(item)).filter(Boolean).join(" / ")
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatConfirmationResult(value: SendJob["confirmation_result"]) {
  if (!value) return "待人工检查"
  if (typeof value === "string") return value
  if (isRecord(value)) {
    const nested = isRecord(value.confirmation) ? value.confirmation : {}
    const source = { ...nested, ...value }
    const reasonCode = formatEvidenceValue(source.reason_code)
    const phase = formatEvidenceValue(source.phase)
    if (phase === "blocked_before_send" && reasonCode) return `发送前已拦截：${formatSendErrorCode(reasonCode)}`
    if (reasonCode) return formatSendErrorCode(reasonCode)
  }
  return JSON.stringify(value)
}

function JobHeader({ id, status, time, danger }: { id: string; status: string; time?: string | null; danger?: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="truncate text-sm font-semibold text-slate-800">{id}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${danger ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-600"}`}>
          {status}
        </span>
        <span className="text-xs text-slate-400 tabular-nums">{formatDate(time)}</span>
      </div>
    </div>
  )
}

function ReplyCardHeader({ time }: { time?: string | null }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-slate-800">风险提醒</span>
      <span className="text-xs text-slate-400 tabular-nums">{formatDate(time)}</span>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-700">{value || "--"}</span>
    </div>
  )
}

function formatConversationLabel(value: string) {
  return value.replace(/^friend:/, "").replace(/^group:/, "")
}

function TextBlock({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      <p className={`line-clamp-4 rounded-md bg-white px-3 py-2 text-sm leading-relaxed ${strong ? "text-slate-800" : "text-slate-600"}`}>
        {value || "--"}
      </p>
    </div>
  )
}

function ControlActions({
  conversationId,
  busyTarget,
  onControl,
}: {
  conversationId: string
  busyTarget: string
  onControl: (target: ActionTarget) => void
}) {
  const takeoverKey = `takeover:${conversationId}`
  const pauseKey = `pause:${conversationId}`
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        disabled={busyTarget === takeoverKey}
        onClick={() => onControl({ conversationId, action: "takeover" })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Hand className="h-3.5 w-3.5" />
        {busyTarget === takeoverKey ? "处理中" : "人工接管"}
      </button>
      <button
        disabled={busyTarget === pauseKey}
        onClick={() => onControl({ conversationId, action: "pause" })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <Pause className="h-3.5 w-3.5" />
        {busyTarget === pauseKey ? "处理中" : "暂停会话"}
      </button>
    </div>
  )
}

function normalizeRiskLevel(value: string | null | undefined): RiskLevel {
  const normalized = String(value || "UNKNOWN").trim().toUpperCase()
  return normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW" ? normalized : "UNKNOWN"
}

function isReviewRiskReplyJob(job: ReplyJob) {
  const riskLevel = normalizeRiskLevel(job.risk_level)
  return riskLevel === "HIGH" || riskLevel === "MEDIUM"
}

function normalizeReasonCodes(value: ReplyJob["reason_codes"]) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((item) => String(item).trim()).filter(Boolean)
    } catch {
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean)
    }
    return [trimmed]
  }
  return []
}

function formatReasonCode(code: string) {
  const reason = getReasonCodeDetail(code)
  return `${reason.label}（${reason.code}）`
}

function getReasonCodeDetail(code: unknown): ReasonCatalogItem & { code: string } {
  const normalized = String(code || "").trim()
  const item = REASON_CODE_CATALOG[normalized]
  if (item) return { ...item, code: normalized }
  return {
    code: normalized || "--",
    label: normalized ? "未知原因" : "未提供原因",
    description: normalized ? "未识别的原因码，保留原码用于排障。" : "后端没有提供原因码。",
    action: normalized ? "建议操作：结合上下文和日志人工判断。" : undefined,
  }
}

function formatSendStatus(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return "--"
  const direct = SEND_STATUS_CATALOG[raw]
  const lower = SEND_STATUS_CATALOG[raw.toLowerCase()]
  const label = direct || lower
  return label ? `${label}（${raw}）` : raw
}

function formatSendErrorCode(value: unknown) {
  const raw = String(value || "").trim()
  if (!raw) return "--"
  return formatReasonCode(raw)
}

function formatReviewReason(value: unknown) {
  const raw = formatEvidenceValue(value)
  if (!raw) return ""
  if (REVIEW_REASON_CATALOG[raw]) return `${REVIEW_REASON_CATALOG[raw]}（${raw}）`
  if (REASON_CODE_CATALOG[raw]) return formatReasonCode(raw)
  if (SEND_STATUS_CATALOG[raw] || SEND_STATUS_CATALOG[raw.toLowerCase()]) return formatSendStatus(raw)
  return raw
}

function formatKnowledgeTrustStatus(value: unknown) {
  const raw = String(value || "").trim()
  const labels: Record<string, string> = {
    trusted: "知识库可信",
    fake: "测试向量",
    untrusted: "未声明可信",
    unknown: "可信状态未知",
  }
  return labels[raw] ? `${labels[raw]}（${raw}）` : raw
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringify(value: unknown) {
  return value === null || value === undefined || value === "" ? "--" : String(value)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}
