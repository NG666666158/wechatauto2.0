"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { useServerEvents } from "@/hooks/use-server-events"
import { apiClient } from "@/lib/api"
import type { KnowledgeAcceptanceHistoryRecord, KnowledgeImportResult, KnowledgeSearchResult, KnowledgeStatus, KnowledgeTrustDiagnostics, WebKnowledgeBuildResult } from "@/lib/api"
import { BookOpen, Cloud, Database, FileText, History, RefreshCw, Search, ShieldCheck, UploadCloud } from "lucide-react"

export default function KnowledgePage() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [query, setQuery] = useState("")
  const [filePathsText, setFilePathsText] = useState("")
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [acceptanceHistory, setAcceptanceHistory] = useState<KnowledgeAcceptanceHistoryRecord[]>([])
  const [trustDiagnostics, setTrustDiagnostics] = useState<KnowledgeTrustDiagnostics | null>(null)
  const [importResult, setImportResult] = useState<KnowledgeImportResult | null>(null)
  const [webResult, setWebResult] = useState<WebKnowledgeBuildResult | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busyAction, setBusyAction] = useState<"search" | "acceptance" | "import" | "web" | "">("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const loadStatus = useCallback(async () => {
    setError("")
    setLoadingStatus(true)
    try {
      const response = await apiClient.getKnowledgeStatus()
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "知识库状态加载失败")
        return
      }
      setStatus(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接知识库服务")
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  const loadAcceptanceHistory = useCallback(async () => {
    try {
      const response = await apiClient.getKnowledgeAcceptanceHistory(8)
      setAcceptanceHistory(response.success && response.data ? response.data : [])
    } catch {
      setAcceptanceHistory([])
    }
  }, [])

  const loadTrustDiagnostics = useCallback(async () => {
    try {
      const response = await apiClient.getKnowledgeTrustDiagnostics()
      setTrustDiagnostics(response.success && response.data ? response.data : null)
    } catch {
      setTrustDiagnostics(null)
    }
  }, [])

  async function searchKnowledge() {
    const keyword = query.trim()
    if (!keyword) {
      setError("请输入要检索的问题或关键词")
      return
    }
    setBusyAction("search")
    setError("")
    setNotice("")
    try {
      const response = await apiClient.searchKnowledge(keyword, 5)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "知识库检索失败")
        return
      }
      setSearchResults(response.data)
      await loadAcceptanceHistory()
      await loadTrustDiagnostics()
      setNotice(`已返回 ${response.data.length} 条检索结果。`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接检索接口")
    } finally {
      setBusyAction("")
    }
  }

  async function runAcceptanceCheck() {
    const keyword = query.trim()
    if (!keyword) {
      setError("Please enter a query before running RAG acceptance")
      return
    }
    setBusyAction("acceptance")
    setError("")
    setNotice("")
    try {
      const response = await apiClient.buildKnowledgeAcceptanceSnapshot(keyword)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "Knowledge acceptance failed")
        return
      }
      setSearchResults(response.data.retrieved_chunks)
      setNotice(`RAG acceptance recorded: ${response.data.retrieved_chunk_ids.length} chunks`)
      await loadStatus()
      await loadAcceptanceHistory()
      await loadTrustDiagnostics()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Knowledge acceptance API unavailable")
    } finally {
      setBusyAction("")
    }
  }

  async function importFiles() {
    const filePaths = parseFilePaths(filePathsText)
    if (!filePaths.length) {
      setError("请先填写或拖入至少一个本地文件路径")
      return
    }
    setBusyAction("import")
    setError("")
    setNotice("")
    try {
      const response = await apiClient.importKnowledgeFiles(filePaths)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "文件入库失败")
        return
      }
      setImportResult(response.data)
      setNotice(response.data.index_rebuilt ? "文件已入库并重建索引。" : "文件已提交入库。")
      await loadStatus()
      await loadAcceptanceHistory()
      await loadTrustDiagnostics()
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接文件入库接口")
    } finally {
      setBusyAction("")
    }
  }

  async function buildWebKnowledge() {
    const filePaths = parseFilePaths(filePathsText)
    if (!filePaths.length) {
      setError("请先提供用于联网扩库的文档路径")
      return
    }
    setBusyAction("web")
    setError("")
    setNotice("")
    try {
      const response = await apiClient.buildWebKnowledgeFromDocuments(filePaths, 5)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "联网扩库失败")
        return
      }
      setWebResult(response.data)
      setNotice(`联网扩库任务完成：${response.data.status}`)
      await loadStatus()
      await loadTrustDiagnostics()
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接联网扩库接口")
    } finally {
      setBusyAction("")
    }
  }

  function handleDrop(event: React.DragEvent<HTMLTextAreaElement>) {
    event.preventDefault()
    const dropped = Array.from(event.dataTransfer.files).map((file) => filePathFromDrop(file))
    if (!dropped.length) return
    setFilePathsText((current) => [current.trim(), ...dropped].filter(Boolean).join("\n"))
  }

  useEffect(() => {
    void loadStatus()
    void loadAcceptanceHistory()
    void loadTrustDiagnostics()
  }, [loadStatus, loadAcceptanceHistory, loadTrustDiagnostics])

  useServerEvents(() => {
    void loadStatus()
    void loadAcceptanceHistory()
    void loadTrustDiagnostics()
  }, { eventTypes: ["knowledge.progress"], replay: 1 })

  return (
    <AppShell title="知识库">
      <div className="grid min-h-[656px] flex-1 grid-cols-[1.05fr_0.95fr] gap-5 bg-[#f6f8fb] p-6">
        <section className="space-y-5">
          {error ? <ErrorState message={error} /> : null}
          {notice ? <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}
          {loadingStatus ? <LoadingState label="正在读取知识库状态" /> : <StatusPanel status={status} onRefresh={loadStatus} />}

          <KnowledgeTrustGate diagnostics={trustDiagnostics} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <UploadCloud className="h-4 w-4 text-blue-500" />
              本地文件入库
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              支持把 PDF、DOCX、图片、TXT、Markdown 等文档路径提交给后端拆分入库。桌面壳接入后可把拖拽文件自动转换为绝对路径。
            </p>
            <textarea
              value={filePathsText}
              onChange={(event) => setFilePathsText(event.target.value)}
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              rows={7}
              placeholder={"每行一个本地文件路径，例如：\nC:\\docs\\产品手册.pdf\nC:\\docs\\行业资料.docx"}
              className="w-full resize-none rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-blue-400"
            />
            <div className="mt-4 flex gap-3">
              <button
                disabled={busyAction === "import"}
                onClick={importFiles}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Database className="h-4 w-4" />
                {busyAction === "import" ? "入库中" : "拆分入库"}
              </button>
              <button
                disabled={busyAction === "web"}
                onClick={buildWebKnowledge}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white text-sm font-semibold text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <Cloud className="h-4 w-4" />
                {busyAction === "web" ? "扩库中" : "联网扩库"}
              </button>
            </div>
          </div>

          <ResultPanel importResult={importResult} webResult={webResult} />
        </section>

        <section className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <Search className="h-4 w-4 text-blue-500" />
              知识库检索
            </div>
            <div className="flex gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchKnowledge()
                }}
                placeholder="输入客户问题，例如：试用政策是什么？"
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-blue-400"
              />
              <button
                disabled={busyAction === "search"}
                onClick={searchKnowledge}
                className="h-10 rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busyAction === "search" ? "检索中" : "检索"}
              </button>
              <button
                disabled={busyAction === "acceptance"}
                onClick={runAcceptanceCheck}
                className="flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <ShieldCheck className="h-4 w-4" />
                {busyAction === "acceptance" ? "验收中" : "RAG 验收"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <BookOpen className="h-4 w-4 text-blue-500" />
              检索结果
            </div>
            {searchResults.length ? (
              <div className="space-y-3">
                {searchResults.map((item) => (
                  <div key={item.chunk_id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{item.chunk_id || "未命名片段"}</span>
                      <span>相关度 {item.score.toFixed(2)}</span>
                    </div>
                    <KnowledgeEvidence item={item} />
                    <p className="text-sm leading-relaxed text-slate-700">{item.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="暂无检索结果">先导入文档，或输入问题后点击检索。</EmptyState>
            )}
          </div>
          <AcceptanceHistoryPanel records={acceptanceHistory} />
        </section>
      </div>
    </AppShell>
  )
}

function KnowledgeTrustGate({ diagnostics }: { diagnostics: KnowledgeTrustDiagnostics | null }) {
  if (!diagnostics) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-800">RAG Trust Gate</div>
        <div className="mt-2 text-xs text-slate-500">Diagnostics unavailable.</div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-800">RAG Trust Gate</div>
        <span className={`rounded-md border px-2 py-1 text-xs font-medium ${trustBadgeClass(diagnostics.trust_status)}`}>
          {formatKnowledgeTrustStatus(diagnostics.trust_status)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        <EvidenceCell label="provider" value={diagnostics.embedding_provider || "-"} />
        <EvidenceCell label="real_send" value={diagnostics.real_send_enabled ? "enabled" : "disabled"} />
        <EvidenceCell label="blocked_for_real_send" value={diagnostics.blocked_for_real_send ? "blocked" : "not blocked"} />
        <EvidenceCell label="reason" value={diagnostics.trust_reason || "-"} />
      </div>
      <HistoryTokenRow label="recommended_actions" values={diagnostics.recommended_actions.map(formatRecommendedAction)} />
    </div>
  )
}

function AcceptanceHistoryPanel({ records }: { records: KnowledgeAcceptanceHistoryRecord[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        <History className="h-4 w-4 text-emerald-500" />
        Knowledge Acceptance History
      </div>
      {records.length ? (
        <div className="space-y-3">
          {records.map((history) => (
            <div key={`${history.created_at}-${history.search_query}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-slate-800">{history.search_query || "empty query"}</span>
                <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${trustBadgeClass(history.knowledge_trust_status)}`}>
                  {formatKnowledgeTrustStatus(history.knowledge_trust_status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <EvidenceCell label="created_at" value={formatDate(history.created_at)} />
                <EvidenceCell label="provider" value={history.embedding_provider || "-"} />
                <EvidenceCell label="ready" value={history.knowledge_ready ? "ready" : "not ready"} />
                <EvidenceCell label="web_build" value={history.web_build_status || "-"} />
              </div>
              <HistoryTokenRow label="retrieved_chunk_ids" values={history.retrieved_chunk_ids} />
              <HistoryTokenRow label="imported_files" values={history.imported_files} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No acceptance history">Run a RAG acceptance check to create an auditable compact record.</EmptyState>
      )}
    </div>
  )
}

function HistoryTokenRow({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="mt-2">
      <div className="mb-1 text-[10px] uppercase text-slate-400">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.length ? (
          values.map((value) => (
            <span key={value} className="max-w-full truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
              {value}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-400">none</span>
        )}
      </div>
    </div>
  )
}

function KnowledgeEvidence({ item }: { item: KnowledgeSearchResult }) {
  const retrieval_sources = item.retrieval_sources ?? []
  const match_terms = item.match_terms ?? []
  const dense_score = formatScore(item.dense_score)
  const keyword_score = formatScore(item.keyword_score)
  const doc_id = item.doc_id || textFromEvidence(item.evidence, "doc_id")
  const source = item.source || textFromEvidence(item.evidence, "source")
  const chunk_index = item.chunk_index || textFromEvidence(item.evidence, "chunk_index")
  const trustStatus = item.embedding_trust_status || "unknown"
  const trustReason = item.embedding_trust_reason || ""

  return (
    <div className="mb-3 space-y-2 text-xs text-slate-500">
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-md border px-2 py-1 font-medium ${trustBadgeClass(trustStatus)}`}>
          {formatKnowledgeTrustStatus(trustStatus)}
        </span>
        {trustReason ? (
          <span className="rounded-md border border-orange-100 bg-orange-50 px-2 py-1 text-orange-700">
            {formatKnowledgeTrustReason(trustReason)}
          </span>
        ) : null}
        {retrieval_sources.length ? (
          retrieval_sources.map((sourceName) => (
            <span key={sourceName} className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-medium text-blue-700">
              {sourceName}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-500">source unknown</span>
        )}
        {match_terms.map((term) => (
          <span key={term} className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-700">
            {term}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EvidenceCell label="dense_score" value={dense_score} />
        <EvidenceCell label="keyword_score" value={keyword_score} />
        <EvidenceCell label="doc_id" value={doc_id || "-"} />
        <EvidenceCell label="chunk_index" value={chunk_index || "-"} />
      </div>
      {item.embedding_provider ? <div className="truncate">embedding_provider: {item.embedding_provider}</div> : null}
      {source ? <div className="truncate">source: {source}</div> : null}
    </div>
  )
}

function trustBadgeClass(status: string) {
  if (status === "trusted") return "border-emerald-100 bg-emerald-50 text-emerald-700"
  if (status === "fake") return "border-orange-100 bg-orange-50 text-orange-700"
  if (status === "untrusted") return "border-red-100 bg-red-50 text-red-700"
  return "border-slate-200 bg-white text-slate-500"
}

function formatKnowledgeTrustStatus(status: string) {
  if (status === "trusted") return "trusted"
  if (status === "fake") return "fake embedding - review"
  if (status === "untrusted") return "untrusted - review"
  return "unknown trust"
}

function formatKnowledgeTrustReason(reason: string) {
  if (reason === "fake_embedding_provider") return "fake_embedding_provider"
  if (reason === "embedding_trust_not_declared") return "embedding_trust_not_declared"
  if (reason === "embedding_provider_missing") return "embedding_provider_missing"
  return reason
}

function formatRecommendedAction(action: string) {
  if (action === "rebuild_with_trusted_embeddings") return "rebuild_with_trusted_embeddings"
  if (action === "route_replies_to_manual_review") return "route_replies_to_manual_review"
  if (action === "disable_real_send_until_trusted") return "disable_real_send_until_trusted"
  if (action === "import_knowledge_files") return "import_knowledge_files"
  if (action === "monitor_acceptance_history") return "monitor_acceptance_history"
  return action
}

function EvidenceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className="truncate font-medium text-slate-700">{value}</div>
    </div>
  )
}

function textFromEvidence(evidence: Record<string, unknown> | undefined, key: string) {
  const value = evidence?.[key]
  return typeof value === "string" ? value : ""
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "-"
}

function filePathFromDrop(file: File) {
  const maybeDesktopFile = file as File & { path?: string }
  return maybeDesktopFile.path || file.name
}

function StatusPanel({ status, onRefresh }: { status: KnowledgeStatus | null; onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
          <Database className="h-4 w-4 text-blue-500" />
          知识库状态
        </div>
        <button onClick={onRefresh} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" />
          刷新
        </button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <Metric label="索引状态" value={status?.ready ? "已就绪" : "未就绪"} accent={status?.ready ? "green" : "orange"} />
        <Metric label="文档数" value={String(status?.documents_loaded ?? 0)} />
        <Metric label="片段数" value={String(status?.chunks_created ?? 0)} />
        <Metric label="向量模型" value={status?.embedding_provider || "本地检索"} />
        <Metric
          label="Embedding trust"
          value={formatEmbeddingTrust(status?.embedding_trusted)}
          accent={status?.embedding_trusted === false ? "orange" : status?.embedding_trusted ? "green" : undefined}
        />
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
        <div>索引路径：{status?.index_path || "暂无"}</div>
        <div>支持格式：{status?.supported_extensions?.join("、") || "等待后端返回"}</div>
        <div>最近构建：{formatDate(status?.last_built_at)}</div>
      </div>
    </div>
  )
}

function formatEmbeddingTrust(value: boolean | null | undefined) {
  if (value === true) return "trusted"
  if (value === false) return "untrusted - review"
  return "unknown"
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "green" | "orange" }) {
  const color = accent === "green" ? "text-emerald-600" : accent === "orange" ? "text-orange-600" : "text-slate-900"
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

function ResultPanel({
  importResult,
  webResult,
}: {
  importResult: KnowledgeImportResult | null
  webResult: WebKnowledgeBuildResult | null
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        <FileText className="h-4 w-4 text-blue-500" />
        最近任务
      </div>
      {!importResult && !webResult ? (
        <EmptyState title="暂无入库任务">提交本地文件或联网扩库后，这里会显示最近结果。</EmptyState>
      ) : (
        <div className="space-y-3">
          {importResult ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-slate-800">本地入库</div>
              <div className="text-xs text-slate-500">索引重建：{importResult.index_rebuilt ? "是" : "否"}</div>
              <div className="mt-2 space-y-1">
                {importResult.files.map((file) => (
                  <div key={`${file.file_name}-${file.status}`} className="flex justify-between gap-3 text-xs text-slate-600">
                    <span className="truncate">{file.file_name}</span>
                    <span>{file.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {webResult ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
              <div className="mb-2 text-sm font-semibold text-slate-800">联网扩库</div>
              <div className="text-xs text-slate-500">状态：{webResult.status}，搜索上限：{webResult.search_limit}</div>
              <div className="mt-2 space-y-1">
                {webResult.documents.map((document) => (
                  <div key={document} className="truncate text-xs text-slate-600">{document}</div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function parseFilePaths(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatDate(value: string | null | undefined) {
  if (!value) return "暂无"
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
