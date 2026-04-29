"use client"

import type { ReactNode } from "react"
import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { EmptyState, ErrorState, LoadingState } from "@/components/api-state"
import { UserAvatar } from "@/components/user-avatar"
import { toast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import type { Customer, SelfIdentity } from "@/lib/api"
import { Pencil, Save, Search, Sparkles, X } from "lucide-react"

type CustomerEditState = {
  display_name: string
  tagsText: string
  remark: string
  status: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selfIdentity, setSelfIdentity] = useState<SelfIdentity | null>(null)
  const [selfName, setSelfName] = useState("")
  const [selfFactsText, setSelfFactsText] = useState("")
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [customerEdit, setCustomerEdit] = useState<CustomerEditState>({ display_name: "", tagsText: "", remark: "", status: "" })
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [savingSelf, setSavingSelf] = useState(false)
  const [generatingSelf, setGeneratingSelf] = useState(false)
  const [error, setError] = useState("")

  async function loadInitialData() {
    setLoading(true)
    setError("")
    try {
      const [customersResponse, selfResponse] = await Promise.all([
        apiClient.listCustomers(),
        apiClient.getGlobalSelfIdentity(),
      ])
      if (!customersResponse.success || !customersResponse.data) {
        setError(customersResponse.error ? `${customersResponse.error.code}: ${customersResponse.error.message}` : "客户列表加载失败")
        return
      }
      const customerList = customersResponse.data
      setCustomers(customerList)
      setSelectedId((current) => current || customerList[0]?.customer_id || "")
      if (selfResponse.success && selfResponse.data) {
        setSelfIdentity(selfResponse.data)
        setSelfName(selfResponse.data.display_name)
        setSelfFactsText(selfResponse.data.identity_facts.join("\n"))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接本地后端服务")
    } finally {
      setLoading(false)
    }
  }

  async function loadCustomer(customerId: string) {
    if (!customerId) {
      setSelectedCustomer(null)
      return
    }
    setLoadingDetail(true)
    setError("")
    try {
      const response = await apiClient.getCustomer(customerId)
      if (!response.success || !response.data) {
        setError(response.error ? `${response.error.code}: ${response.error.message}` : "客户详情加载失败")
        return
      }
      setSelectedCustomer(response.data)
      setCustomerEdit(buildCustomerEditState(response.data))
      setEditingCustomer(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取客户详情")
    } finally {
      setLoadingDetail(false)
    }
  }

  async function saveSelfIdentity() {
    setSavingSelf(true)
    setError("")
    const facts = selfFactsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
    try {
      const response = await apiClient.updateGlobalSelfIdentity({
        display_name: selfName.trim() || "未命名身份",
        identity_facts: facts,
      })
      if (!response.success || !response.data) {
        toast({
          title: "自我身份保存失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      setSelfIdentity(response.data)
      setSelfName(response.data.display_name)
      setSelfFactsText(response.data.identity_facts.join("\n"))
      toast({ title: "自我身份已保存", duration: 1800 })
    } catch (err) {
      toast({
        title: "自我身份保存失败",
        description: err instanceof Error ? err.message : "无法保存自我身份",
        variant: "destructive",
        duration: 1800,
      })
    } finally {
      setSavingSelf(false)
    }
  }

  async function generateSelfIdentityFacts() {
    const displayName = selfName.trim()
    if (!displayName) {
      toast({
        title: "请先填写显示名称",
        description: "例如：AI 电商陪跑客服、课程顾问、财税顾问。",
        variant: "destructive",
        duration: 1800,
      })
      return
    }
    setGeneratingSelf(true)
    try {
      const response = await apiClient.generateGlobalSelfIdentity({ display_name: displayName })
      if (!response.success || !response.data) {
        toast({
          title: "AI 生成失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 2200,
        })
        return
      }
      setSelfName(response.data.display_name)
      setSelfFactsText(response.data.identity_facts.join("\n"))
      toast({ title: "身份事实已生成", description: "请确认后再保存。", duration: 1800 })
    } catch (err) {
      toast({
        title: "AI 生成失败",
        description: err instanceof Error ? err.message : "无法连接本地大模型接口",
        variant: "destructive",
        duration: 2200,
      })
    } finally {
      setGeneratingSelf(false)
    }
  }

  async function saveCustomer() {
    if (!selectedCustomer) return
    setSavingCustomer(true)
    setError("")
    try {
      const response = await apiClient.updateCustomer(selectedCustomer.customer_id, {
        display_name: customerEdit.display_name.trim(),
        tags: splitTags(customerEdit.tagsText),
        remark: customerEdit.remark.trim(),
        status: customerEdit.status.trim(),
      })
      if (!response.success || !response.data) {
        toast({
          title: "客户资料保存失败",
          description: formatCustomerSaveError(response.error),
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      setSelectedCustomer(response.data)
      setCustomerEdit(buildCustomerEditState(response.data))
      setCustomers((current) => current.map((item) => (item.customer_id === response.data!.customer_id ? response.data! : item)))
      setEditingCustomer(false)
      toast({ title: "客户资料已保存", duration: 1800 })
    } catch (err) {
      toast({
        title: "客户资料保存失败",
        description: err instanceof Error ? err.message : "无法保存客户资料",
        variant: "destructive",
        duration: 1800,
      })
    } finally {
      setSavingCustomer(false)
    }
  }

  useEffect(() => {
    void loadInitialData()
  }, [])

  useEffect(() => {
    void loadCustomer(selectedId)
  }, [selectedId])

  const filteredCustomers = customers.filter((customer) => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return true
    return `${customer.display_name} ${customer.status} ${customer.tags.join(" ")} ${customer.remark}`.toLowerCase().includes(keyword)
  })

  return (
    <AppShell title="客户">
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden bg-[var(--app-content-bg)] p-4">
        <aside className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="mb-3 text-[15px] font-semibold text-slate-800">客户列表</h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索客户、标签或备注"
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4">
                <LoadingState label="正在加载客户" />
              </div>
            ) : filteredCustomers.length ? (
              <ul>
                {filteredCustomers.map((customer) => (
                  <CustomerRow
                    key={customer.customer_id}
                    customer={customer}
                    active={customer.customer_id === selectedId}
                    onClick={() => setSelectedId(customer.customer_id)}
                  />
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState title="暂无客户" />
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-slate-800">客户详情</h2>
            {selectedCustomer ? (
              editingCustomer ? (
                <div className="flex items-center gap-2">
                  <button
                    disabled={savingCustomer}
                    onClick={saveCustomer}
                    className="flex h-8 items-center gap-1.5 rounded-lg bg-blue-500 px-3 text-xs font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingCustomer ? "保存中" : "保存"}
                  </button>
                  <button
                    disabled={savingCustomer}
                    onClick={() => {
                      setCustomerEdit(buildCustomerEditState(selectedCustomer))
                      setEditingCustomer(false)
                    }}
                    className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    <X className="h-3.5 w-3.5" />
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingCustomer(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )
            ) : null}
          </div>

          {loadingDetail ? (
            <LoadingState label="正在加载客户详情" />
          ) : selectedCustomer ? (
            <CustomerDetail
              customer={selectedCustomer}
              editing={editingCustomer}
              editState={customerEdit}
              onEditChange={setCustomerEdit}
            />
          ) : (
            <EmptyState title="请选择客户" />
          )}
        </section>

        <aside className="w-[330px] shrink-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <SelfIdentityCard
            identity={selfIdentity}
            name={selfName}
            factsText={selfFactsText}
            saving={savingSelf}
            generating={generatingSelf}
            compact
            onNameChange={setSelfName}
            onFactsChange={setSelfFactsText}
            onGenerate={generateSelfIdentityFacts}
            onSave={saveSelfIdentity}
          />
        </aside>
      </div>
    </AppShell>
  )
}

function CustomerRow({ customer, active, onClick }: { customer: Customer; active: boolean; onClick: () => void }) {
  const primaryTag = customer.tags[0] || statusText(customer.status)
  return (
    <li
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 border-b border-slate-100 px-5 py-3 ${
        active ? "bg-blue-50/70" : "hover:bg-slate-50"
      }`}
    >
      <UserAvatar name={customer.display_name || customer.customer_id} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-800">{customer.display_name || customer.customer_id}</div>
        <div className="mt-0.5 truncate text-xs text-slate-400">{formatDate(customer.last_contact_at)}</div>
      </div>
      <span className={`rounded px-2 py-0.5 text-[11px] ${tagClass(primaryTag)}`}>{primaryTag}</span>
    </li>
  )
}

function CustomerDetail({
  customer,
  editing,
  editState,
  onEditChange,
}: {
  customer: Customer
  editing: boolean
  editState: CustomerEditState
  onEditChange: (value: CustomerEditState) => void
}) {
  const displayName = editing ? editState.display_name : customer.display_name || customer.customer_id
  const tags = editing ? splitTags(editState.tagsText) : customer.tags
  const remark = editing ? editState.remark : customer.remark
  const status = editing ? editState.status : customer.status
  const previewCustomer = { ...customer, display_name: displayName, tags, remark, status }
  return (
    <>
      <div className="mb-4 flex items-center gap-4">
        <UserAvatar name={displayName || customer.customer_id} size={56} />
        <div>
          <div className="text-[17px] font-semibold text-slate-800">{displayName || customer.customer_id}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(tags.length ? tags : [statusText(status)]).map((tag) => (
              <span key={tag} className={`rounded px-2 py-0.5 text-xs ${tagClass(tag)}`}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <dl className="space-y-3 text-sm">
        <Field label="客户 ID" value={customer.customer_id} />
        <Field
          label="客户名称"
          value={
            editing ? (
              <input
                value={editState.display_name}
                onChange={(event) => onEditChange({ ...editState, display_name: event.target.value })}
                className="h-8 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
              />
            ) : displayName || "未命名客户"
          }
        />
        <Field
          label="标签"
          value={
            editing ? (
              <input
                value={editState.tagsText}
                onChange={(event) => onEditChange({ ...editState, tagsText: event.target.value })}
                placeholder="多个标签用逗号分隔"
                className="h-8 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
              />
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {(tags.length ? tags : [statusText(status)]).map((tag) => (
                  <span key={tag} className={`rounded px-2 py-0.5 text-xs ${tagClass(tag)}`}>{tag}</span>
                ))}
              </div>
            )
          }
        />
        <Field
          label="用户身份"
          value={
            editing ? (
              <textarea
                value={editState.remark}
                onChange={(event) => onEditChange({ ...editState, remark: event.target.value })}
                rows={3}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-blue-400"
              />
            ) : remark || "暂无用户身份，可点击右上角编辑补充。"
          }
        />
        <Field label="最近联系" value={formatDate(customer.last_contact_at)} />
        <Field label="来源渠道" value="微信会话 / 身份识别链路" />
      </dl>
      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
        交给模型作为用户身份依据：客户名称、标签、用户身份和来源渠道。客户 ID、最近联系只用于系统记录和排序。
      </div>
    </>
  )
}

function SelfIdentityCard({
  className,
  identity,
  name,
  factsText,
  saving,
  generating,
  compact,
  onNameChange,
  onFactsChange,
  onGenerate,
  onSave,
}: {
  className?: string
  identity: SelfIdentity | null
  name: string
  factsText: string
  saving: boolean
  generating: boolean
  compact?: boolean
  onNameChange: (value: string) => void
  onFactsChange: (value: string) => void
  onGenerate: () => void
  onSave: () => void
}) {
  return (
    <div className={className ?? ""}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 whitespace-nowrap text-[15px] font-semibold text-slate-800">
            <Sparkles className="h-4 w-4 text-blue-500" />
            全局自我身份
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            disabled={saving || generating}
            onClick={onGenerate}
            className="flex h-8 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {generating ? "生成中" : "AI生成"}
          </button>
          <button
            disabled={saving}
            onClick={onSave}
            className="flex h-8 items-center gap-1 rounded-lg bg-blue-500 px-2.5 text-xs font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中" : "保存"}
          </button>
        </div>
      </div>
      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        <label className="text-xs font-medium text-slate-600">
          显示名称
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder={identity?.display_name || "例如：碱水"}
            className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          身份事实（一行一条）
          <textarea
            value={factsText}
            onChange={(event) => onFactsChange(event.target.value)}
            rows={compact ? 14 : 5}
            placeholder="例如：我是产品顾问&#10;面对客户时保持专业友好"
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 focus:border-blue-400 focus:outline-none"
          />
        </label>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-6">
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className="flex-1 text-slate-800">{value}</dd>
    </div>
  )
}

function statusText(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "intent") return "意向客户"
  if (normalized === "follow_up") return "跟进中"
  if (normalized === "confirmed") return "已确认"
  if (normalized === "not_found") return "未找到"
  return status || "未分类"
}

function tagClass(tag: string) {
  if (tag.includes("高")) return "bg-orange-100 text-orange-600"
  if (tag.includes("潜在") || tag.includes("跟进")) return "bg-blue-100 text-blue-600"
  if (tag.includes("意向") || tag.includes("确认")) return "bg-emerald-100 text-emerald-600"
  return "bg-slate-100 text-slate-500"
}

function buildCustomerEditState(customer: Customer): CustomerEditState {
  return {
    display_name: customer.display_name || customer.customer_id,
    tagsText: customer.tags.join("，"),
    remark: customer.remark || "",
    status: customer.status || "draft",
  }
}

function splitTags(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCustomerSaveError(error: { code: string; message: string } | null) {
  if (!error) {
    return "请稍后重试"
  }
  if (error.code === "HTTP_405") {
    return "当前本地服务版本过旧，还没有客户资料保存接口。请在首页重新启动本地服务后再保存。"
  }
  return `${error.code}: ${error.message || "请稍后重试"}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return "暂无记录"
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
