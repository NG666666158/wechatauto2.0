"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { apiClient } from "@/lib/api"
import type { ConversationControlPatch, ReplyJob, SendJob } from "@/lib/api"
import { AlertTriangle, Bot, Hand, Pause, RefreshCw, ShieldAlert } from "lucide-react"

type ActionTarget = {
  conversationId: string
  action: "takeover" | "pause"
}

export default function PendingPage() {
  const [replyJobs, setReplyJobs] = useState<ReplyJob[]>([])
  const [sendJobs, setSendJobs] = useState<SendJob[]>([])
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
                  busyTarget={busyTarget}
                  onControl={updateControl}
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
}: {
  job: ReplyJob
  busyTarget: string
  onControl: (target: ActionTarget) => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <JobHeader id={job.reply_job_id} status={job.status} time={job.updated_at ?? job.created_at} />
      <MetaRow label="会话" value={job.conversation_id} />
      <MetaRow label="风险" value={job.risk_level || "LOW"} />
      <TextBlock label="触发消息" value={job.input_text} />
      <TextBlock label="草稿回复" value={job.draft_reply || "暂无草稿内容"} strong />
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
}

function SendJobCard({
  job,
  busyTarget,
  onControl,
}: {
  job: SendJob
  busyTarget: string
  onControl: (target: ActionTarget) => void
}) {
  return (
    <article className="rounded-lg border border-rose-100 bg-rose-50/40 p-4">
      <JobHeader id={job.send_job_id} status={job.status} time={job.updated_at ?? job.created_at} danger />
      <MetaRow label="会话" value={job.target_title || job.conversation_id} />
      <MetaRow label="确认结果" value={formatConfirmationResult(job.confirmation_result)} />
      <TextBlock label="发送内容" value={job.content} strong />
      <div className="mt-3 flex items-start gap-2 rounded-md bg-white px-3 py-2 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>该记录不会在此页面重发，请先人工核对微信窗口中的真实发送状态。</span>
      </div>
      <ControlActions conversationId={job.conversation_id} busyTarget={busyTarget} onControl={onControl} />
    </article>
  )
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
