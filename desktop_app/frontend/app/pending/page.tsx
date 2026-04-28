"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { apiClient } from "@/lib/api"
import type { ConversationControlPatch, ReplyJob, SendAttempt, SendJob } from "@/lib/api"
import { AlertTriangle, Bot, Check, CheckCircle2, Hand, Pause, RefreshCw, ShieldAlert, X } from "lucide-react"

type ActionTarget = {
  conversationId: string
  action: "takeover" | "pause"
}

type ReplyActionTarget = {
  replyJobId: string
  action: "approve" | "cancel"
  draftReply?: string | null
}

type SendActionTarget = {
  sendJobId: string
  resolution: "confirmed" | "failed"
  unpauseConversation?: boolean
}

export default function PendingPage() {
  const [replyJobs, setReplyJobs] = useState<ReplyJob[]>([])
  const [sendJobs, setSendJobs] = useState<SendJob[]>([])
  const [attemptsBySendJob, setAttemptsBySendJob] = useState<Record<string, SendAttempt[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [busyTarget, setBusyTarget] = useState("")

  async function loadPending({ quiet = false } = {}) {
    if (quiet) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError("")
    try {
      const [replies, uncertainSends] = await Promise.all([
        apiClient.listReplyJobs(undefined, 50),
        apiClient.listUncertainSendJobs(50),
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
  }, [])

  const stats = useMemo(
    () => [
      { label: "待审核回复", value: replyJobs.length, tone: "text-blue-600" },
      { label: "发送不确定", value: sendJobs.length, tone: "text-rose-600" },
      { label: "需人工检查", value: replyJobs.length + sendJobs.length, tone: "text-amber-600" },
    ],
    [replyJobs.length, sendJobs.length],
  )

  async function updateControl({ conversationId, action }: ActionTarget) {
    const patchBody: ConversationControlPatch = action === "takeover" ? { human_takeover: true } : { paused: true }
    setBusyTarget(`${action}:${conversationId}`)
    setError("")
    setNotice("")
    try {
      const response = await apiClient.updateConversationControl(conversationId, patchBody)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "会话控制更新失败")
        return
      }
      setNotice(action === "takeover" ? `已将 ${conversationId} 标记为人工接管` : `已暂停 ${conversationId} 会话`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法更新会话控制")
    } finally {
      setBusyTarget("")
    }
  }

  async function updateReplyJob({ replyJobId, action, draftReply }: ReplyActionTarget) {
    const targetKey = `reply:${action}:${replyJobId}`
    setBusyTarget(targetKey)
    setError("")
    setNotice("")
    try {
      const response =
        action === "approve"
          ? await apiClient.approveReplyJob(replyJobId, {
              ...(draftReply ? { draft_reply: draftReply } : {}),
              reason: "manual_approve",
              reviewed_by: "operator",
            })
          : await apiClient.cancelReplyJob(replyJobId, { reason: "manual_cancel", reviewed_by: "operator" })
      if (!response.success) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "ReplyJob 操作失败")
        return
      }
      await loadPending({ quiet: true })
      setNotice(action === "approve" ? `已批准 ReplyJob ${replyJobId}` : `已取消 ReplyJob ${replyJobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法更新 ReplyJob")
    } finally {
      setBusyTarget("")
    }
  }

  async function resolveSendJob({ sendJobId, resolution, unpauseConversation = false }: SendActionTarget) {
    const targetKey = `send:${resolution}:${unpauseConversation ? "unpause" : "keep"}:${sendJobId}`
    setBusyTarget(targetKey)
    setError("")
    setNotice("")
    try {
      const response = await apiClient.resolveSendJob(sendJobId, {
        resolution,
        reason: resolution === "confirmed" ? "manual_confirmed" : "manual_failed",
        reviewed_by: "operator",
        unpause_conversation: unpauseConversation,
      })
      if (!response.success) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "SendJob 操作失败")
        return
      }
      await loadPending({ quiet: true })
      setNotice(
        resolution === "confirmed"
          ? `已标记 SendJob ${sendJobId} 为已确认${unpauseConversation ? "，并恢复会话" : ""}`
          : `已标记 SendJob ${sendJobId} 为失败`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法更新 SendJob")
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
      <div className="flex min-h-[656px] flex-1 flex-col bg-[#f6f7f9] p-6">
        <div className="mb-4 grid grid-cols-3 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">{item.label}</div>
              <div className={`mt-2 text-2xl font-semibold tabular-nums ${item.tone}`}>{item.value}</div>
            </div>
          ))}
        </div>

        {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
        {notice ? <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div> : null}

        {loading ? (
          <LoadingState label="正在加载待处理事项" />
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-5">
            <QueuePanel
              title="待审核回复"
              subtitle="reply_jobs"
              icon={<Bot className="h-4 w-4 text-blue-500" />}
              emptyTitle="暂无待审核回复"
            >
              {replyJobs.map((job) => (
                <ReplyJobCard
                  key={job.reply_job_id}
                  job={job}
                  busyTarget={busyTarget}
                  onControl={updateControl}
                  onReplyAction={updateReplyJob}
                />
              ))}
            </QueuePanel>

            <QueuePanel
              title="发送异常"
              subtitle="SEND_UNCERTAIN"
              icon={<ShieldAlert className="h-4 w-4 text-rose-500" />}
              emptyTitle="暂无发送不确定记录"
            >
              {sendJobs.map((job) => (
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
  children,
}: {
  title: string
  subtitle: string
  icon: ReactNode
  emptyTitle: string
  children: ReactNode
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[15px] font-semibold text-slate-800">{title}</h2>
        </div>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{subtitle}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {hasChildren ? children : <EmptyState title={emptyTitle}>当前队列已经清空。</EmptyState>}
      </div>
    </section>
  )
}

function ReplyJobCard({
  job,
  busyTarget,
  onControl,
  onReplyAction,
}: {
  job: ReplyJob
  busyTarget: string
  onControl: (target: ActionTarget) => void
  onReplyAction: (target: ReplyActionTarget) => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <JobHeader id={job.reply_job_id} status={job.status} time={job.updated_at ?? job.created_at} />
      <ReplyRiskSummary job={job} />
      <MetaRow label="会话" value={job.conversation_id} />
      <ReplyReviewAudit job={job} />
      <TextBlock label="触发消息" value={job.input_text} />
      <TextBlock label="草稿回复" value={job.draft_reply || "暂无草稿内容"} strong />
      <ReplyJobActions job={job} busyTarget={busyTarget} onReplyAction={onReplyAction} />
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
}

function ReplyRiskSummary({ job }: { job: ReplyJob }) {
  const riskLevel = normalizeRiskLevel(job.risk_level)
  const reasonCodes = normalizeReasonCodes(job.reason_codes)
  const riskClass = riskLevel === "HIGH"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : riskLevel === "MEDIUM"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700"

  return (
    <div className="mt-2 rounded-md bg-white px-3 py-2">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">risk_level</span>
        <span className={`rounded border px-2 py-0.5 font-semibold ${riskClass}`}>{riskLevel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {reasonCodes.length ? reasonCodes.map((code) => (
          <span key={code} className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
            {formatReasonCode(code)}
          </span>
        )) : (
          <span className="text-xs text-slate-400">reason_codes: --</span>
        )}
      </div>
    </div>
  )
}

function ReplyReviewAudit({ job }: { job: ReplyJob }) {
  if (!job.reviewed_by && !job.reviewed_at && !job.review_reason) {
    return null
  }
  return (
    <div className="mt-2 rounded-md bg-white px-3 py-2">
      {job.reviewed_by ? <MetaRow label="reviewed_by" value={job.reviewed_by} /> : null}
      {job.reviewed_at ? <MetaRow label="reviewed_at" value={formatDate(job.reviewed_at)} /> : null}
      {job.review_reason ? <MetaRow label="review_reason" value={job.review_reason} /> : null}
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
      <TextBlock label="发送内容" value={job.content} strong />
      <SendAttemptList attempts={attempts} />
      <div className="mt-3 flex items-start gap-2 rounded-md bg-white px-3 py-2 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>该记录不会在此页面重发，请先人工核对微信窗口中的真实发送状态。</span>
      </div>
      <SendJobActions job={job} busyTarget={busyTarget} onResolve={onResolve} />
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
}

function SendAttemptList({ attempts }: { attempts: SendAttempt[] }) {
  if (!attempts.length) {
    return null
  }
  return (
    <div className="mt-3 rounded-md bg-white px-3 py-2">
      <div className="mb-2 text-xs font-semibold text-slate-500">send_attempts</div>
      <div className="space-y-2">
        {attempts.map((attempt) => (
          <div key={attempt.attempt_id} className="rounded border border-slate-100 bg-slate-50 px-2 py-2">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-700">
                #{attempt.attempt_no} {attempt.status}
              </span>
              <span className="text-slate-400">{formatDate(attempt.finished_at ?? attempt.started_at)}</span>
            </div>
            {attempt.error_code ? <MetaRow label="error_code" value={attempt.error_code} /> : null}
            {attempt.error_message ? <MetaRow label="error_message" value={attempt.error_message} /> : null}
            {attempt.before_screenshot ? <MetaRow label="before_screenshot" value={attempt.before_screenshot} /> : null}
            {attempt.after_screenshot ? <MetaRow label="after_screenshot" value={attempt.after_screenshot} /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReplyJobActions({
  job,
  busyTarget,
  onReplyAction,
}: {
  job: ReplyJob
  busyTarget: string
  onReplyAction: (target: ReplyActionTarget) => void
}) {
  const approveKey = `reply:approve:${job.reply_job_id}`
  const cancelKey = `reply:cancel:${job.reply_job_id}`
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button
        disabled={busyTarget === approveKey}
        onClick={() => onReplyAction({ replyJobId: job.reply_job_id, action: "approve", draftReply: job.draft_reply })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <Check className="h-3.5 w-3.5" />
        {busyTarget === approveKey ? "处理中" : "批准"}
      </button>
      <button
        disabled={busyTarget === cancelKey}
        onClick={() => onReplyAction({ replyJobId: job.reply_job_id, action: "cancel" })}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        <X className="h-3.5 w-3.5" />
        {busyTarget === cancelKey ? "处理中" : "取消"}
      </button>
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
        {busyTarget === confirmedKey ? "处理中" : "标记已确认"}
      </button>
      <button
        disabled={busyTarget === confirmedRestoreKey}
        onClick={() =>
          onResolve({ sendJobId: job.send_job_id, resolution: "confirmed", unpauseConversation: true })
        }
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

function formatConfirmationEvidence(job: SendJob): ConfirmationEvidence {
  const value = job.confirmation_result
  const summary = formatConfirmationResult(value)
  if (!value || typeof value === "string") {
    return { summary, fields: [] }
  }
  const nested = typeof value.confirmation === "object" && value.confirmation !== null && !Array.isArray(value.confirmation)
    ? (value.confirmation as Record<string, unknown>)
    : {}
  const source = {
    ...nested,
    ...value,
    before_screenshot: value.before_screenshot ?? nested.before_screenshot ?? job.before_screenshot,
    after_screenshot: value.after_screenshot ?? nested.after_screenshot ?? job.after_screenshot,
  }

  const fields = [
    evidenceField(source, "reason", "reason"),
    evidenceField(source, "resolution", "resolution"),
    evidenceField(source, "visible_messages", "visible_messages", true),
    evidenceField(source, "matched_text", "matched_text", true),
    evidenceField(source, "before_screenshot", "before_screenshot"),
    evidenceField(source, "after_screenshot", "after_screenshot"),
  ].filter((item): item is ConfirmationEvidence["fields"][number] => Boolean(item))

  return {
    summary: fields.length ? "evidence available" : summary,
    fields,
  }
}

function evidenceField(
  source: Record<string, unknown>,
  key: string,
  label: string,
  multiline = false,
): ConfirmationEvidence["fields"][number] | null {
  if (!(key in source)) return null
  const value = formatEvidenceValue(source[key])
  return value ? { key, label, value, multiline } : null
}

function formatEvidenceValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    return value.map((item) => formatEvidenceValue(item)).filter(Boolean).join(" / ")
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatConfirmationResult(value: SendJob["confirmation_result"]) {
  if (!value) {
    return "待人工检查"
  }
  if (typeof value === "string") {
    return value
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

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-700">{value || "--"}</span>
    </div>
  )
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

function normalizeRiskLevel(value: string | null | undefined) {
  const normalized = String(value || "LOW").trim().toUpperCase()
  return normalized || "LOW"
}

function normalizeReasonCodes(value: ReplyJob["reason_codes"]) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean)
      }
    } catch {
      return trimmed.split(",").map((item) => item.trim()).filter(Boolean)
    }
    return [trimmed]
  }
  return []
}

function formatReasonCode(code: string) {
  const labels: Record<string, string> = {
    PROMPT_INJECTION: "prompt injection",
    SENSITIVE_INFORMATION: "sensitive information",
    HIGH_RISK_INTENT: "high risk intent",
    HIGH_RISK_COMMITMENT: "high risk commitment",
  }
  return labels[code] ? `${code}: ${labels[code]}` : code
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
