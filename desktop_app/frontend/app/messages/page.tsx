"use client"

import type { ReactNode } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { UserAvatar } from "@/components/user-avatar"
import { useServerEvents } from "@/hooks/use-server-events"
import { apiClient } from "@/lib/api"
import type { ConversationDetail, ConversationListItem } from "@/lib/api"
import { Search } from "lucide-react"

export default function MessagesPage() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [query, setQuery] = useState("")
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState("")
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)

  const loadConversations = useCallback(async () => {
    setError("")
    const response = await apiClient.listConversations()
    if (!response.success || !response.data) {
      setError(response.error ? `${response.error.code}: ${response.error.message}` : "会话列表加载失败")
      setLoadingList(false)
      return
    }
    const list = response.data
    setConversations(list)
    setSelectedId((current) => current || list[0]?.conversation_id || "")
    setLoadingList(false)
  }, [])

  const loadConversation = useCallback(async (conversationId: string) => {
    if (!conversationId) return
    setLoadingDetail(true)
    setError("")
    const response = await apiClient.getConversation(conversationId)
    if (!response.success || !response.data) {
      setError(response.error ? `${response.error.code}: ${response.error.message}` : "会话详情加载失败")
      setLoadingDetail(false)
      return
    }
    setDetail(response.data)
    setLoadingDetail(false)
  }, [])

  useEffect(() => {
    void loadConversations().catch((err: unknown) => {
      setLoadingList(false)
      setError(err instanceof Error ? err.message : "无法连接本地后端服务")
    })
  }, [loadConversations])

  useEffect(() => {
    void loadConversation(selectedId).catch((err: unknown) => {
      setLoadingDetail(false)
      setError(err instanceof Error ? err.message : "无法读取会话详情")
    })
  }, [loadConversation, selectedId])

  useServerEvents(
    (event) => {
      if (event.type === "message.sent" || event.type === "message.received") {
        void loadConversations()
        if (selectedId) void loadConversation(selectedId)
        return
      }
      if (event.type === "log.event") {
        const eventType = String(event.data.event_type ?? "")
        if (eventType === "conversation.control.updated" && selectedId) {
          void loadConversation(selectedId)
        }
      }
    },
    { eventTypes: ["message.sent", "message.received", "log.event"], replay: 1 },
  )

  const filtered = conversations.filter((item) => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return true
    return `${item.title} ${item.latest_message}`.toLowerCase().includes(keyword)
  })
  useEffect(() => {
    const scrollArea = messagesScrollRef.current
    if (!scrollArea || !detail) return
    const frame = window.requestAnimationFrame(() => {
      scrollArea.scrollTop = scrollArea.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [detail?.conversation.conversation_id, detail?.messages.length])

  return (
    <AppShell title="消息">
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden bg-[var(--app-content-bg)] p-4">
        <aside className="flex w-[260px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">会话列表</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索客户或内容"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="p-4">
                <LoadingState label="正在加载会话" />
              </div>
            ) : filtered.length ? (
              <ul>
                {filtered.map((item) => (
                  <ConversationRow
                    key={item.conversation_id}
                    item={item}
                    active={item.conversation_id === selectedId}
                    onClick={() => setSelectedId(item.conversation_id)}
                  />
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="暂无会话" />
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {error ? (
            <div className="p-3">
              <ErrorState message={error} />
            </div>
          ) : null}
          {loadingDetail ? (
            <div className="p-5">
              <LoadingState label="正在加载会话详情" />
            </div>
          ) : detail ? (
            <>
              <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-[var(--app-surface)] px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="truncate text-[15px] font-semibold text-slate-800">{detail.conversation.title}</span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                    {detail.conversation.is_group ? "群聊" : "微信"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-slate-400">
                  <span className="text-xs tabular-nums">{formatTime(detail.conversation.updated_at)}</span>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col bg-white">
                <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[var(--app-content-bg)] px-5 py-4 pb-6">
                  {detail.messages.length ? (
                    detail.messages.map((message) =>
                      message.direction === "outgoing" ? (
                        <OutgoingBubble key={message.message_id} time={formatTime(message.sent_at)}>
                          {message.text}
                        </OutgoingBubble>
                      ) : (
                        <IncomingBubble key={message.message_id} name={message.sender || detail.conversation.title} time={formatTime(message.sent_at)}>
                          {message.text}
                        </IncomingBubble>
                      ),
                    )
                  ) : (
                    <EmptyState title="暂无消息记录" />
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-5">
              <EmptyState title="请选择一个会话" />
            </div>
          )}
        </section>

        <aside className="w-[240px] shrink-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <RecordSummaryPanel detail={detail} />
        </aside>
      </div>
    </AppShell>
  )
}

function ConversationRow({ item, active, onClick }: { item: ConversationListItem; active: boolean; onClick: () => void }) {
  return (
    <li
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 ${active ? "bg-blue-50/70" : "hover:bg-slate-50"}`}
    >
      <UserAvatar name={item.title} size={38} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-slate-800">{item.title}</span>
          <span className="shrink-0 text-xs text-slate-400 tabular-nums">{formatTime(item.updated_at)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-slate-500">{item.latest_message}</span>
          {item.unread_count ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
              {item.unread_count}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function RecordSummaryPanel({ detail }: { detail: ConversationDetail | null }) {
  const control = detail?.control
  const incomingCount = detail?.messages.filter((message) => message.direction === "incoming").length ?? 0
  const outgoingCount = detail?.messages.filter((message) => message.direction === "outgoing").length ?? 0
  if (!detail) {
    return <EmptyState title="请选择会话" />
  }

  return (
    <div>
      <div className="mb-3 text-sm font-medium text-slate-800">记录摘要</div>
      <dl className="space-y-3 text-xs">
        <InfoRow label="类型">
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-600">{detail.conversation.is_group ? "群聊" : "个人客户"}</span>
        </InfoRow>
        <InfoRow label="状态">
          <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-600">{control?.paused ? "已暂停" : "跟进中"}</span>
        </InfoRow>
        <InfoRow label="人工接管">
          <StatusText active={Boolean(control?.human_takeover)} />
        </InfoRow>
        <InfoRow label="会话暂停">
          <StatusText active={Boolean(control?.paused)} />
        </InfoRow>
        <InfoRow label="黑名单">
          <StatusText active={Boolean(control?.blacklisted)} danger />
        </InfoRow>
        <InfoRow label="记录数">
          <span className="text-slate-600 tabular-nums">{detail.messages.length}</span>
        </InfoRow>
        <InfoRow label="收到">
          <span className="text-slate-600 tabular-nums">{incomingCount}</span>
        </InfoRow>
        <InfoRow label="回复">
          <span className="text-slate-600 tabular-nums">{outgoingCount}</span>
        </InfoRow>
        <InfoRow label="最近联系">
          <span className="text-slate-600 tabular-nums">{formatDate(detail?.conversation.updated_at)}</span>
        </InfoRow>
      </dl>
    </div>
  )
}

function StatusText({ active, danger }: { active: boolean; danger?: boolean }) {
  return (
    <span className={`rounded px-2 py-0.5 ${active ? (danger ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600") : "bg-slate-50 text-slate-500"}`}>
      {active ? "是" : "否"}
    </span>
  )
}

function IncomingBubble({ name, time, children }: { name: string; time?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <UserAvatar name={name} size={30} />
      <div className="min-w-0">
        <div className="max-w-[390px] break-words rounded-2xl rounded-tl-sm bg-white px-4 py-2 text-sm text-slate-800 shadow-sm">{children}</div>
        {time ? <div className="mt-1 text-xs text-slate-400">{time}</div> : null}
      </div>
    </div>
  )
}

function OutgoingBubble({ time, children }: { time?: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-end gap-2">
      <div className="min-w-0 max-w-[390px]">
        <div className="mb-1 flex items-center justify-end gap-1.5 text-xs text-slate-400">
          <span>AI 回复</span>
          {time ? <span className="tabular-nums">{time}</span> : null}
        </div>
        <div className="break-words rounded-2xl rounded-tr-sm bg-[#95ec69] px-4 py-2 text-sm text-slate-800">{children}</div>
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">{children}</dd>
    </div>
  )
}

function formatTime(value: string | null | undefined) {
  if (!value) return "--:--"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(11, 16) || "--:--"
  return parsed.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
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
