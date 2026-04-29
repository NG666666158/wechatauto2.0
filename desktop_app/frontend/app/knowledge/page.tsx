"use client"

import { useCallback, useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { useServerEvents } from "@/hooks/use-server-events"
import { apiClient } from "@/lib/api"
import { getPathForFile, selectKnowledgeFiles } from "@/lib/electron-shell"
import type { ApiErrorPayload, KnowledgeAcceptanceReport, KnowledgeImportResult, KnowledgeSearchResult, KnowledgeStatus, KnowledgeTask } from "@/lib/api"
import { BookOpen, Cloud, Database, FileText, FolderOpen, RefreshCw, Search, ShieldCheck, UploadCloud } from "lucide-react"

export default function KnowledgePage() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null)
  const [query, setQuery] = useState("")
  const [filePathsText, setFilePathsText] = useState("")
  const [selectedImportCount, setSelectedImportCount] = useState(0)
  const [importNotice, setImportNotice] = useState("")
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[]>([])
  const [reportQuestions, setReportQuestions] = useState("")
  const [acceptanceReport, setAcceptanceReport] = useState<KnowledgeAcceptanceReport | null>(null)
  const [tasks, setTasks] = useState<KnowledgeTask[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [busyAction, setBusyAction] = useState<"search" | "acceptance" | "report" | "import" | "web" | "">("")
  const [error, setError] = useState("")
  const [searchError, setSearchError] = useState("")
  const [resultsOpen, setResultsOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

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

  const loadTasks = useCallback(async () => {
    try {
      const response = await apiClient.listKnowledgeTasks(12)
      if (response.success && response.data) {
        setTasks(response.data)
      }
    } catch {
      // 最近任务只是观测信息，接口暂不可用时不阻断知识库页面。
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
    setSearchError("")
    try {
      const response = await apiClient.searchKnowledge(keyword, 5)
      if (!response.success || !response.data) {
        const message = response.error ? `检索出错：${response.error.message}` : "检索出错：知识库检索失败"
        setSearchResults([])
        setSearchError(message)
        setResultsOpen(true)
        return
      }
      setSearchResults(response.data)
      setResultsOpen(true)
      toast({ title: `已返回 ${response.data.length} 条检索结果`, duration: 1800 })
    } catch (err) {
      setSearchResults([])
      setSearchError(err instanceof Error ? `检索出错：${err.message}` : "检索出错：无法连接检索接口")
      setResultsOpen(true)
    } finally {
      setBusyAction("")
    }
  }

  async function runAcceptanceCheck() {
    const keyword = query.trim()
    if (!keyword) {
      setError("请先输入要验收的问题")
      return
    }
    setBusyAction("acceptance")
    setError("")
    setSearchError("")
    try {
      const response = await apiClient.buildKnowledgeAcceptanceSnapshot(keyword)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "知识库验收失败")
        return
      }
      setSearchResults(response.data.retrieved_chunks)
      setResultsOpen(true)
      toast({ title: "知识库验收已记录", description: `${response.data.retrieved_chunk_ids.length} 个片段`, duration: 1800 })
      await loadStatus()
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : "知识库验收接口不可用")
    } finally {
      setBusyAction("")
    }
  }

  async function buildAcceptanceReport() {
    const questions = reportQuestions
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
    if (!questions.length) {
      setError("请先逐行输入验收问题")
      return
    }
    setBusyAction("report")
    setError("")
    try {
      const response = await apiClient.buildKnowledgeAcceptanceReport({ questions, limit: 3, min_top_score: 0.7 })
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "知识库验收报告生成失败")
        return
      }
      setAcceptanceReport(response.data)
      setReportOpen(true)
      toast({ title: response.data.needs_review ? "验收完成，存在需复核项" : "验收完成，命中正常", duration: 1800 })
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接知识库验收报告接口")
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
    setSelectedImportCount(filePaths.length)
    setImportNotice(`已选择 ${filePaths.length} 个文档，正在入库...`)
    setBusyAction("import")
    setError("")
    try {
      const response = await apiClient.importKnowledgeFiles(filePaths)
      if (!response.success || !response.data) {
        setImportNotice(`入库失败：${formatApiErrorMessage(response.error, "文件入库失败")}`)
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "文件入库失败")
        return
      }
      setImportNotice(formatImportSuccessMessage(response.data, filePaths.length))
      toast({ title: response.data.index_rebuilt ? "文件已入库并重建索引" : "文件已提交入库", duration: 1800 })
      await loadStatus()
      await loadTasks()
    } catch (err) {
      setImportNotice(`入库失败：${err instanceof Error ? err.message : "无法连接文件入库接口"}`)
      setError(err instanceof Error ? err.message : "无法连接文件入库接口")
    } finally {
      setBusyAction("")
    }
  }

  async function selectAndImportFiles() {
    setBusyAction("import")
    setError("")
    setImportNotice("")
    setSelectedImportCount(0)
    try {
      const selected = await selectKnowledgeFilesFromShell()
      if (!selected.length) {
        setImportNotice("未选择文档")
        return
      }
      setSelectedImportCount(selected.length)
      setFilePathsText(selected.join("\n"))
      setImportNotice(`已选择 ${selected.length} 个文档，正在入库...`)
      const response = await apiClient.importKnowledgeFiles(selected)
      if (!response.success || !response.data) {
        setImportNotice(`入库失败：${formatApiErrorMessage(response.error, "文件入库失败")}`)
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "文件入库失败")
        await loadTasks()
        return
      }
      setImportNotice(formatImportSuccessMessage(response.data, selected.length))
      toast({
        title: response.data.index_rebuilt ? "文档已入库并重建索引" : "文档已提交入库",
        description: `${selected.length} 个文档`,
        duration: 1800,
      })
      await loadStatus()
      await loadTasks()
    } catch (err) {
      const message = err instanceof Error ? err.message : "无法打开文件选择器"
      setImportNotice(`入库失败：${message}`)
      setError(message)
      await loadTasks()
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
    try {
      const response = await apiClient.buildWebKnowledgeFromDocuments(filePaths, 5)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "联网扩库失败")
        return
      }
      toast({ title: "联网扩库任务完成", description: response.data.status, duration: 1800 })
      await loadStatus()
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接联网扩库接口")
    } finally {
      setBusyAction("")
    }
  }

  function handleDropLegacy(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const dropped = Array.from(event.dataTransfer.files)
      .map((file) => filePathFromDrop(file))
      .filter(Boolean)
    if (!dropped.length) {
      setImportNotice("拖拽未拿到本地绝对路径，请使用“选择文档入库”按钮")
      return
    }
    setFilePathsText((current) => [current.trim(), ...dropped].filter(Boolean).join("\n"))
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>) {
    event.preventDefault()
    event.stopPropagation()
    const files = Array.from(event.dataTransfer.files)
    if (!files.length) {
      setImportNotice("未识别到可入库文件")
      return
    }
    const droppedPaths = files.map((file) => filePathFromDrop(file)).filter(Boolean)
    setBusyAction("import")
    setError("")
    setSelectedImportCount(files.length)
    setImportNotice(`已拖入 ${files.length} 个文档，正在入库...`)
    try {
      const response =
        droppedPaths.length === files.length
          ? await apiClient.importKnowledgeFiles(droppedPaths)
          : await apiClient.uploadKnowledgeFiles(files)
      if (droppedPaths.length) {
        setFilePathsText((current) => [current.trim(), ...droppedPaths].filter(Boolean).join("\n"))
      }
      if (!response.success || !response.data) {
        setImportNotice(`入库失败：${formatApiErrorMessage(response.error, "文件入库失败")}`)
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "文件入库失败")
        await loadTasks()
        return
      }
      setImportNotice(formatImportSuccessMessage(response.data, files.length))
      toast({
        title: response.data.index_rebuilt ? "文档已入库并重建索引" : "文档已提交入库",
        description: `${files.length} 个文档`,
        duration: 1800,
      })
      await loadStatus()
      await loadTasks()
    } catch (err) {
      const message = err instanceof Error ? err.message : "无法完成拖拽入库"
      setImportNotice(`入库失败：${message}`)
      setError(message)
      await loadTasks()
    } finally {
      setBusyAction("")
    }
  }

  useEffect(() => {
    void loadStatus()
    void loadTasks()
  }, [loadStatus, loadTasks])

  useServerEvents(() => {
    void loadStatus()
    void loadTasks()
  }, { eventTypes: ["knowledge.progress"], replay: 1 })

  return (
    <AppShell title="知识库">
      <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_0.95fr] gap-4 overflow-hidden bg-[var(--app-content-bg)] p-4">
        <section className="min-h-0 space-y-4 overflow-y-auto pr-1">
          {error ? <ErrorState message={error} /> : null}
          {loadingStatus ? <LoadingState label="正在读取知识库状态" /> : <StatusPanel status={status} onRefresh={loadStatus} />}

          <div
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <UploadCloud className="h-4 w-4 text-blue-500" />
              本地文件入库
            </div>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              支持把 PDF、DOCX、图片、TXT、Markdown 等资料路径提交给后端抽取、切分和索引。
            </p>
            <button
              disabled={busyAction === "import"}
              onClick={selectAndImportFiles}
              className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-500 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <FolderOpen className="h-4 w-4" />
              {busyAction === "import" ? "入库中" : "选择文档入库"}
            </button>
            {importNotice ? (
              <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <span className="min-w-0 truncate">{importNotice}</span>
                {selectedImportCount ? <span className="shrink-0 font-medium">{selectedImportCount} 个</span> : null}
              </div>
            ) : null}
            <textarea
              value={filePathsText}
              onChange={(event) => setFilePathsText(event.target.value)}
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
                {busyAction === "import" ? "入库中" : "手动路径入库"}
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
        </section>

        <section className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <Search className="h-4 w-4 text-blue-500" />
              知识库检索
            </div>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchKnowledge()
                }}
                placeholder="输入客户问题，例如：试用政策是什么？"
                className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none focus:border-blue-400"
              />
              <button
                disabled={busyAction === "search"}
                onClick={searchKnowledge}
                className="h-10 w-16 shrink-0 rounded-xl bg-blue-500 text-sm font-semibold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busyAction === "search" ? "检索中" : "检索"}
              </button>
              <button
                disabled={!searchResults.length}
                onClick={() => setResultsOpen(true)}
                className="h-10 w-20 shrink-0 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                查看结果
              </button>
              <button
                disabled={busyAction === "acceptance"}
                onClick={runAcceptanceCheck}
                className="flex h-10 w-24 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                <ShieldCheck className="h-4 w-4" />
                {busyAction === "acceptance" ? "验收中" : "知识验收"}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              检索验收报告
            </div>
            <textarea
              value={reportQuestions}
              onChange={(event) => setReportQuestions(event.target.value)}
              rows={4}
              placeholder={"每行一个测试问题，例如：\n试用政策是什么？\n退款争议怎么处理？"}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800 outline-none focus:border-blue-400"
            />
            <button
              disabled={busyAction === "report"}
              onClick={buildAcceptanceReport}
              className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busyAction === "report" ? "生成中" : "生成验收报告"}
            </button>
          </div>
          <ResultPanel tasks={tasks} />
        </section>
      </div>
      <SearchResultsDialog open={resultsOpen} onOpenChange={setResultsOpen} results={searchResults} error={searchError} />
      <AcceptanceReportDialog open={reportOpen} onOpenChange={setReportOpen} report={acceptanceReport} />
    </AppShell>
  )
}

function SearchResultsDialog({
  open,
  onOpenChange,
  results,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  results: KnowledgeSearchResult[]
  error: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-[900px] overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
            <BookOpen className="h-4 w-4 text-blue-500" />
            检索结果
          </DialogTitle>
          <DialogDescription>
            {error ? "检索出错，请查看提示后重试。" : `共找到 ${results.length} 条相关片段，可在此滚动浏览。`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[66vh] overflow-y-auto bg-slate-50/60 px-5 py-4">
          {error ? (
            <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm leading-relaxed text-red-600">
              {error}
            </div>
          ) : results.length ? (
            <div className="space-y-3">
              {results.map((item, index) => <SearchResultCard key={item.chunk_id || `${item.doc_id || "doc"}-${index}`} item={item} index={index} />)}
            </div>
          ) : (
            <EmptyState title="暂无匹配片段">没有找到相关知识片段，可以换个关键词再试。</EmptyState>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SearchResultCard({ item, index }: { item: KnowledgeSearchResult; index: number }) {
  const source = formatSearchResultSource(item)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-sm font-semibold text-slate-800">片段 {index + 1}</div>
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          相关度 {formatScore(item.score)}
        </span>
      </div>
      <div className="mb-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <div className="mb-1 font-medium text-slate-400">来源</div>
          <div className="truncate text-slate-700" title={source}>
            {source}
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 sm:min-w-28">
          <div className="mb-1 font-medium text-slate-400">相关度分数</div>
          <div className="font-semibold text-slate-700">{formatScore(item.score)}</div>
        </div>
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
        <div className="mb-2 text-xs font-medium text-slate-400">内容片段</div>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{item.text || "该片段暂无可展示内容。"}</p>
      </div>
    </article>
  )
}

function AcceptanceReportDialog({
  open,
  onOpenChange,
  report,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: KnowledgeAcceptanceReport | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-[920px] overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            检索验收报告
          </DialogTitle>
          <DialogDescription>
            {report
              ? `共 ${report.total_questions} 个问题，${report.answered_questions} 个有命中，平均分 ${report.average_top_score.toFixed(2)}。`
              : "暂无报告。"}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[66vh] overflow-y-auto px-5 py-4">
          {!report ? (
            <EmptyState title="暂无验收报告">先输入问题并生成报告。</EmptyState>
          ) : (
            <div className="space-y-3">
              {report.items.map((item, index) => (
                <div key={`${item.query}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 truncate text-sm font-semibold text-slate-800">{item.query}</div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${verdictClass(item.verdict)}`}>
                      {formatVerdict(item.verdict)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                    <EvidenceCell label="片段" value={item.top_chunk_id || "-"} />
                    <EvidenceCell label="分数" value={item.top_score === null ? "-" : item.top_score.toFixed(3)} />
                    <EvidenceCell label="来源" value={item.source || "-"} />
                    <EvidenceCell label="可信" value={formatKnowledgeTrustStatus(item.trust_status || "unknown")} />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    召回：{item.retrieval_sources.join("、") || "-"}；关键词：{item.match_terms.join("、") || "-"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function KnowledgeEvidence({ item, compact = false }: { item: KnowledgeSearchResult; compact?: boolean }) {
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
              {formatRetrievalSource(sourceName)}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-500">来源未知</span>
        )}
        {match_terms.map((term) => (
          <span key={term} className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-emerald-700">
            {term}
          </span>
        ))}
      </div>
      <div className={`grid grid-cols-2 gap-2 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
        <EvidenceCell label="向量分数" value={dense_score} />
        <EvidenceCell label="关键词分数" value={keyword_score} />
        {!compact ? <EvidenceCell label="文档编号" value={doc_id || "-"} /> : null}
        {!compact ? <EvidenceCell label="片段序号" value={chunk_index || "-"} /> : null}
      </div>
      {item.embedding_provider ? <div className="truncate">向量提供方：{formatEmbeddingProvider(item.embedding_provider)}</div> : null}
      {source ? <div className="truncate">来源：{source}</div> : null}
    </div>
  )
}

function StatusPanel({ status, onRefresh }: { status: KnowledgeStatus | null; onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
          <Database className="h-4 w-4 text-blue-500" />
          知识库状态
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">最近构建：{formatDate(status?.last_built_at)}</span>
          <button onClick={onRefresh} className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs text-slate-600 hover:bg-slate-50">
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </button>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2">
        <Metric label="索引状态" value={status?.ready ? "已就绪" : "未就绪"} accent={status?.ready ? "green" : "orange"} />
        <Metric label="文档数" value={String(status?.documents_loaded ?? 0)} />
        <Metric label="片段数" value={String(status?.chunks_created ?? 0)} />
        <Metric label="向量模型" value={formatEmbeddingProvider(status?.embedding_provider) || "本地检索"} />
        <Metric
          label="向量可信度"
          value={formatEmbeddingTrust(status?.embedding_trusted)}
          accent={status?.embedding_trusted === false ? "orange" : status?.embedding_trusted ? "green" : undefined}
        />
      </div>
    </div>
  )
}

function ResultPanel({ tasks }: { tasks: KnowledgeTask[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-800">
        <FileText className="h-4 w-4 text-blue-500" />
        最近任务
      </div>
      {!tasks.length ? (
        <EmptyState title="暂无入库任务">提交本地文件或联网扩库后，这里会显示最近结果。</EmptyState>
      ) : (
        <div className="max-h-56 space-y-3 overflow-y-auto pr-1">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0 truncate text-sm font-semibold text-slate-800">{formatKnowledgeTaskType(task.type)}</div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${taskStatusClass(task.status)}`}>
                  {formatKnowledgeTaskStatus(task.status)}
                </span>
              </div>
              <div className="line-clamp-2 text-xs leading-relaxed text-slate-500">{task.summary || task.title}</div>
              <div className="mt-2 text-xs text-slate-400">阶段：{formatKnowledgeTaskStage(task.stage)}</div>
              {task.error ? (
                <div className="mt-2 line-clamp-2 break-words text-xs text-red-600">
                  失败原因：{formatTaskErrorSummary(task.error)}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-slate-400">{formatDate(task.updated_at || task.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EvidenceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-white px-2 py-1.5">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className="truncate font-medium text-slate-700">{value}</div>
    </div>
  )
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "green" | "orange" }) {
  const color = accent === "green" ? "text-emerald-600" : accent === "orange" ? "text-orange-600" : "text-slate-900"
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-base font-bold ${color}`}>{value}</div>
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
  if (status === "trusted") return "可信"
  if (status === "fake") return "测试向量，需复核"
  if (status === "untrusted") return "未声明可信，需复核"
  return "可信状态未知"
}

function formatKnowledgeTrustReason(reason: string) {
  if (reason === "fake_embedding_provider") return "当前使用测试向量提供方"
  if (reason === "embedding_trust_not_declared") return "向量索引未声明可信"
  if (reason === "embedding_provider_missing") return "缺少向量提供方"
  return reason
}

function formatEmbeddingProvider(provider: string | null | undefined) {
  if (!provider) return "-"
  const normalized = provider.toLowerCase()
  if (normalized.includes("fake")) return "测试向量"
  if (normalized.includes("openai")) return "OpenAI 兼容向量"
  if (normalized.includes("local")) return "本地向量"
  return provider
}

function formatRetrievalSource(source: string) {
  const normalized = source.toLowerCase()
  if (normalized === "dense") return "语义召回"
  if (normalized === "keyword") return "关键词召回"
  if (normalized === "hybrid") return "混合召回"
  return source || "来源未知"
}

function formatEmbeddingTrust(value: boolean | null | undefined) {
  if (value === true) return "可信"
  if (value === false) return "需复核"
  return "未知"
}

function formatKnowledgeTaskType(type: string) {
  if (type === "import") return "本地文件入库"
  if (type === "web_build") return "联网扩库"
  if (type === "rebuild") return "可信向量重建"
  if (type === "ai_normalize") return "AI 入库预处理"
  return type || "知识库任务"
}

function formatKnowledgeTaskStatus(status: string) {
  if (status === "completed") return "已完成"
  if (status === "running") return "进行中"
  if (status === "failed") return "失败"
  if (status === "blocked") return "已阻止"
  if (status === "needs_review") return "需复核"
  return status || "未知"
}

function formatKnowledgeTaskStage(stage: string) {
  if (stage === "queued") return "排队"
  if (stage === "extracting") return "抽取"
  if (stage === "chunking") return "切分"
  if (stage === "embedding") return "向量化"
  if (stage === "indexing") return "索引"
  if (stage === "validating") return "验收"
  if (stage === "completed") return "完成"
  if (stage === "failed") return "失败"
  if (stage === "accept") return "验收"
  return stage || "未知"
}

function formatVerdict(verdict: string) {
  if (verdict === "hit") return "命中"
  if (verdict === "miss") return "未命中"
  if (verdict === "needs_review") return "需复核"
  return verdict || "未知"
}

function verdictClass(verdict: string) {
  if (verdict === "hit") return "bg-emerald-50 text-emerald-700"
  if (verdict === "miss") return "bg-red-50 text-red-700"
  if (verdict === "needs_review") return "bg-orange-50 text-orange-700"
  return "bg-slate-100 text-slate-500"
}

function taskStatusClass(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700"
  if (status === "running") return "bg-blue-50 text-blue-700"
  if (status === "failed") return "bg-red-50 text-red-700"
  if (status === "blocked" || status === "needs_review") return "bg-orange-50 text-orange-700"
  return "bg-slate-100 text-slate-500"
}

function textFromEvidence(evidence: Record<string, unknown> | undefined, key: string) {
  const value = evidence?.[key]
  return typeof value === "string" ? value : ""
}

function formatSearchResultSource(item: KnowledgeSearchResult) {
  return (
    item.source ||
    textFromRecord(item.metadata, "title") ||
    textFromRecord(item.metadata, "source") ||
    textFromRecord(item.metadata, "file_name") ||
    textFromRecord(item.metadata, "path") ||
    textFromRecord(item.evidence, "title") ||
    textFromRecord(item.evidence, "source") ||
    textFromRecord(item.evidence, "doc_id") ||
    item.doc_id ||
    "来源未知"
  )
}

function textFromRecord(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key]
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  return ""
}

function formatScore(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "-"
}

async function selectKnowledgeFilesFromShell() {
  return normalizeSelectedKnowledgeFiles(await selectKnowledgeFiles())
}

function normalizeSelectedKnowledgeFiles(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
  }
  if (!value || typeof value !== "object") {
    return []
  }
  const payload = value as { filePaths?: unknown; paths?: unknown; canceled?: unknown }
  if (payload.canceled) {
    return []
  }
  const paths = Array.isArray(payload.filePaths) ? payload.filePaths : payload.paths
  return Array.isArray(paths)
    ? paths.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : []
}

function formatApiErrorMessage(error: ApiErrorPayload | null, fallback: string) {
  return error?.message || fallback
}

function formatImportSuccessMessage(result: KnowledgeImportResult, selectedCount: number) {
  const files = Array.isArray(result.files) ? result.files : []
  const failed = files.filter((file) => isFailedImportStatus(file.status))
  if (failed.length) {
    const firstFailed = failed[0]?.file_name ? `：${failed[0].file_name}` : ""
    return `入库完成，${failed.length} 个文档失败${firstFailed}`
  }
  const importedCount = files.length || selectedCount
  return result.index_rebuilt ? `入库成功，${importedCount} 个文档已索引` : `入库成功，${importedCount} 个文档已提交`
}

function isFailedImportStatus(status: string) {
  const normalized = status.toLowerCase()
  return normalized.includes("fail") || normalized.includes("error") || normalized.includes("失败")
}

function formatTaskErrorSummary(error: string) {
  const compact = error.replace(/\s+/g, " ").trim()
  return compact.length > 120 ? `${compact.slice(0, 120)}...` : compact
}

function filePathFromDrop(file: File) {
  const path = getPathForFile(file)
  if (path) {
    return path
  }
  return ""
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
