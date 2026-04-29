"use client"

import type { ReactNode } from "react"
import { useEffect, useState, useTransition } from "react"
import { AppShell } from "@/components/app-shell"
import { ErrorState, LoadingState } from "@/components/api-state"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { getDesktopShellBridge, type DesktopShellPreferences } from "@/lib/electron-shell"
import type {
  PrivacyPolicy,
  SafetyPatternRule,
  SafetyPolicyPatch,
  Settings,
  SettingsPatch,
} from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  ChevronDown,
  Clock,
  DatabaseBackup,
  FileClock,
  MessageSquare,
  Plus,
  Power,
  RotateCcw,
  ShieldAlert,
  ShieldBan,
  Trash2,
  UserPlus,
} from "lucide-react"

const tabs = ["基础设置", "回复设置", "客户管理", "高级设置"] as const
const replyStyles = ["专业友好", "自然轻松", "简洁高效"] as const

const safetyRuleGroups = [
  {
    id: "prompt_injection",
    title: "提示词注入防护",
    desc: "忽略规则、系统提示词泄露等输入保持高风险拦截",
  },
  {
    id: "sensitive_information",
    title: "敏感信息防护",
    desc: "验证码、密码、token、账号等输入输出保持高风险拦截",
  },
  {
    id: "business_risk",
    title: "业务风险规则",
    desc: "退款、价格、账号、合同等业务意图和承诺进入人工审核",
  },
] as const

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("基础设置")
  const [settings, setSettings] = useState<Settings | null>(null)
  const [privacy, setPrivacy] = useState<PrivacyPolicy | null>(null)
  const [desktopPreferences, setDesktopPreferences] = useState<DesktopShellPreferences | null>(null)
  const [desktopShellAvailable, setDesktopShellAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  async function loadSettings() {
    setError("")
    const shellBridge = getDesktopShellBridge()
    const [settingsResponse, privacyResponse, shellPreferences] = await Promise.all([
      apiClient.getSettings(),
      apiClient.getPrivacyPolicy(),
      shellBridge.getPreferences(),
    ])
    if (!settingsResponse.success || !privacyResponse.success) {
      const failed = !settingsResponse.success ? settingsResponse : privacyResponse
      setError(failed.error ? `${failed.error.code}: ${failed.error.message}` : "设置数据加载失败")
    }
    setSettings(settingsResponse.data)
    setPrivacy(privacyResponse.data)
    setDesktopShellAvailable(shellBridge.isAvailable())
    setDesktopPreferences(shellPreferences)
    setLoading(false)
  }

  useEffect(() => {
    void loadSettings().catch((err: unknown) => {
      setLoading(false)
      setError(err instanceof Error ? err.message : "无法连接本地后端服务")
    })
  }, [])

  function updateSettings(patch: SettingsPatch, successMessage = "设置已保存") {
    startTransition(async () => {
      setError("")
      const response = await apiClient.updateSettings(patch)
      if (!response.success || !response.data) {
        toast({
          title: "设置保存失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      setSettings(response.data)
      setPrivacy(response.data.privacy)
      toast({ title: successMessage, duration: 1800 })
    })
  }

  function updatePrivacy(patch: Partial<PrivacyPolicy>, successMessage = "隐私策略已保存") {
    startTransition(async () => {
      setError("")
      const response = await apiClient.updatePrivacyPolicy(patch)
      if (!response.success || !response.data) {
        toast({
          title: "隐私策略保存失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      setPrivacy(response.data)
      setSettings((current) => (current ? { ...current, privacy: response.data as PrivacyPolicy } : current))
      toast({ title: successMessage, duration: 1800 })
    })
  }

  function updateDesktopPreferences(
    patch: Partial<DesktopShellPreferences>,
    successMessage = "桌面偏好已保存",
  ) {
    const shellBridge = getDesktopShellBridge()
    if (!shellBridge.isAvailable()) {
      toast({
        title: "桌面偏好保存失败",
        description: "当前不在 Electron 桌面端环境，无法保存桌面偏好",
        variant: "destructive",
        duration: 1800,
      })
      return
    }
    startTransition(async () => {
      setError("")
      const nextPreferences = await shellBridge.updatePreferences(patch)
      if (!nextPreferences) {
        toast({
          title: "桌面偏好保存失败",
          description: "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      setDesktopPreferences(nextPreferences)
      setDesktopShellAvailable(true)
      toast({ title: successMessage, duration: 1800 })
    })
  }

  function importSafetyPolicy(policy: SafetyPolicyPatch) {
    startTransition(async () => {
      setError("")
      const response = await apiClient.importSafetyPolicy({ safety_policy: policy })
      if (!response.success || !response.data) {
        toast({
          title: "安全策略导入失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      const safetyPolicy = response.data
      setSettings((current) => (current ? { ...current, safety_policy: safetyPolicy } : current))
      toast({ title: "安全策略已导入", duration: 1800 })
    })
  }

  function restoreDefaultSafetyPolicy() {
    startTransition(async () => {
      setError("")
      const response = await apiClient.restoreDefaultSafetyPolicy()
      if (!response.success || !response.data) {
        toast({
          title: "安全策略恢复失败",
          description: response.error ? `${response.error.code}: ${response.error.message}` : "请稍后重试",
          variant: "destructive",
          duration: 1800,
        })
        return
      }
      const safetyPolicy = response.data
      setSettings((current) => (current ? { ...current, safety_policy: safetyPolicy } : current))
      toast({ title: "安全策略已恢复默认", duration: 1800 })
    })
  }

  function setSensitiveReview(nextValue: boolean) {
    if (!nextValue && !window.confirm("关闭敏感消息先审核后，自动回复可能直接发出高风险内容。确认关闭吗？")) {
      return
    }
    updateSettings({ sensitive_message_review: nextValue }, nextValue ? "敏感审核已开启" : "敏感审核已关闭")
  }

  return (
    <AppShell title="设置">
      <div className="flex min-h-0 flex-1 overflow-hidden bg-[var(--app-content-bg)]">
        <section className="min-w-0 flex-1 overflow-y-auto p-8">
          <div className="mb-6 flex gap-6 border-b border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative pb-3 text-sm transition-colors",
                  activeTab === tab ? "font-semibold text-blue-600" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {tab}
                {activeTab === tab ? <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-blue-500" /> : null}
              </button>
            ))}
          </div>

          {error ? <div className="mb-4"><ErrorState message={error} /></div> : null}

          {loading ? (
            <LoadingState label="正在读取本地设置" />
          ) : settings && privacy ? (
            <div className="space-y-3">
              {activeTab === "基础设置" ? (
                <BaseSettings
                  settings={settings}
                  pending={isPending}
                  updateSettings={updateSettings}
                />
              ) : null}
              {activeTab === "回复设置" ? (
                <ReplySettings
                  settings={settings}
                  pending={isPending}
                  updateSettings={updateSettings}
                  setSensitiveReview={setSensitiveReview}
                  importSafetyPolicy={importSafetyPolicy}
                  restoreDefaultSafetyPolicy={restoreDefaultSafetyPolicy}
                />
              ) : null}
              {activeTab === "客户管理" ? (
                <CustomerSettings settings={settings} pending={isPending} updateSettings={updateSettings} />
              ) : null}
              {activeTab === "高级设置" ? (
                <AdvancedSettings
                  settings={settings}
                  privacy={privacy}
                  desktopPreferences={desktopPreferences}
                  desktopShellAvailable={desktopShellAvailable}
                  pending={isPending}
                  updateSettings={updateSettings}
                  updatePrivacy={updatePrivacy}
                  updateDesktopPreferences={updateDesktopPreferences}
                />
              ) : null}
            </div>
          ) : (
            <ErrorState message="设置数据为空，请确认后端服务是否运行。" />
          )}
        </section>
      </div>
    </AppShell>
  )
}

function BaseSettings({
  settings,
  pending,
  updateSettings,
}: {
  settings: Settings
  pending: boolean
  updateSettings: (patch: SettingsPatch, successMessage?: string) => void
}) {
  return (
    <>
      <SettingRow
        iconBg="bg-emerald-500"
        icon={<Power className="h-5 w-5 text-white" />}
        title="自动回复开关"
        desc="开启后自动记录并生成回复"
        right={<Switch checked={settings.auto_reply_enabled} disabled={pending} onChange={(value) => updateSettings({ auto_reply_enabled: value })} />}
      />
      <SettingRow
        iconBg="bg-blue-500"
        icon={<Clock className="h-5 w-5 text-white" />}
        title="工作时间"
        desc="仅在工作时间自动运行回复流程"
        right={
          <div className="flex items-center gap-2">
            <TimeInput value={settings.work_hours.start} disabled={pending} onChange={(value) => updateSettings({ work_hours: { ...settings.work_hours, start: value } })} />
            <span className="text-xs text-slate-400">-</span>
            <TimeInput value={settings.work_hours.end} disabled={pending} onChange={(value) => updateSettings({ work_hours: { ...settings.work_hours, end: value } })} />
          </div>
        }
      />
    </>
  )
}

function ReplySettings({
  settings,
  pending,
  updateSettings,
  setSensitiveReview,
  importSafetyPolicy,
  restoreDefaultSafetyPolicy,
}: {
  settings: Settings
  pending: boolean
  updateSettings: (patch: SettingsPatch, successMessage?: string) => void
  setSensitiveReview: (nextValue: boolean) => void
  importSafetyPolicy: (policy: SafetyPolicyPatch) => void
  restoreDefaultSafetyPolicy: () => void
}) {
  const [safetyPolicyJson, setSafetyPolicyJson] = useState("")
  const [safetyPolicyJsonError, setSafetyPolicyJsonError] = useState("")
  const [safetyPatternDrafts, setSafetyPatternDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    setSafetyPolicyJson(JSON.stringify(settings.safety_policy, null, 2))
    setSafetyPolicyJsonError("")
  }, [settings.safety_policy])

  function isRuleGroupEnabled(ruleGroup: string) {
    const configured = settings.safety_policy.rule_groups?.[ruleGroup]
    if (configured !== undefined) {
      return configured
    }
    const rules = [...settings.safety_policy.input_rules, ...settings.safety_policy.output_rules].filter(
      (rule) => rule.rule_group === ruleGroup,
    )
    return rules.length > 0 ? rules.every((rule) => rule.enabled) : false
  }

  function setRuleGroup(ruleGroup: string, nextValue: boolean) {
    updateSettings(
      {
        safety_policy: {
          rule_groups: {
            ...(settings.safety_policy.rule_groups ?? {}),
            [ruleGroup]: nextValue,
          },
        },
      },
      nextValue ? "安全规则组已开启" : "安全规则组已关闭",
    )
  }

  function saveSafetyRulePatterns(ruleId: string, nextPatterns: string[]) {
    const cleanedPatterns = Array.from(new Set(nextPatterns.map((pattern) => pattern.trim()).filter(Boolean)))
    updateSettings(
      {
        safety_policy: {
          ...settings.safety_policy,
          input_rules: settings.safety_policy.input_rules.map((rule) =>
            rule.rule_id === ruleId ? { ...rule, patterns: cleanedPatterns } : rule,
          ),
          output_rules: settings.safety_policy.output_rules.map((rule) =>
            rule.rule_id === ruleId ? { ...rule, patterns: cleanedPatterns } : rule,
          ),
        },
      },
      "安全词已保存",
    )
  }

  function addSafetyPattern(rule: SafetyPatternRule) {
    const draft = (safetyPatternDrafts[rule.rule_id] ?? "").trim()
    if (!draft) {
      return
    }
    saveSafetyRulePatterns(rule.rule_id, [...rule.patterns, draft])
    setSafetyPatternDrafts((current) => ({ ...current, [rule.rule_id]: "" }))
  }

  function removeSafetyPattern(rule: SafetyPatternRule, pattern: string) {
    saveSafetyRulePatterns(
      rule.rule_id,
      rule.patterns.filter((currentPattern) => currentPattern !== pattern),
    )
  }

  function resetSafetyPolicy() {
    restoreDefaultSafetyPolicy()
  }

  async function exportSafetyPolicy() {
    setSafetyPolicyJsonError("")
    const response = await apiClient.exportSafetyPolicy()
    if (!response.success || !response.data) {
      setSafetyPolicyJsonError(response.error ? `${response.error.code}: ${response.error.message}` : "安全策略导出失败")
      return
    }
    setSafetyPolicyJson(JSON.stringify(response.data, null, 2))
  }

  function submitSafetyPolicyImport() {
    setSafetyPolicyJsonError("")
    let parsed: unknown
    try {
      parsed = JSON.parse(safetyPolicyJson)
    } catch {
      setSafetyPolicyJsonError("安全策略配置格式不正确")
      return
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      setSafetyPolicyJsonError("安全策略配置必须是对象格式")
      return
    }
    importSafetyPolicy(parsed as SafetyPolicyPatch)
  }

  return (
    <>
      <SettingRow
        iconBg="bg-violet-500"
        icon={<MessageSquare className="h-5 w-5 text-white" />}
        title="回复风格"
        desc="影响 AI 生成回复时的语气和详略"
        right={
          <SelectValue
            value={settings.reply_style || "专业友好"}
            disabled={pending}
            options={replyStyles}
            onChange={(value) => updateSettings({ reply_style: value })}
          />
        }
      />
      <SettingRow
        iconBg="bg-blue-500"
        icon={<Clock className="h-5 w-5 text-white" />}
        title="请求超时"
        desc="模型和知识库检索的最长等待时间"
        right={<NumberInput value={settings.request_timeout_seconds} min={1} max={300} disabled={pending} suffix="秒" onChange={(value) => updateSettings({ request_timeout_seconds: value })} />}
      />
      <SettingRow
        iconBg="bg-emerald-500"
        icon={<Power className="h-5 w-5 text-white" />}
        title="重试次数"
        desc="网络或模型临时失败时的自动重试次数"
        right={<NumberInput value={settings.retry_attempts} min={0} max={10} disabled={pending} suffix="次" onChange={(value) => updateSettings({ retry_attempts: value })} />}
      />
      <SettingRow
        iconBg="bg-rose-500"
        icon={<ShieldAlert className="h-5 w-5 text-white" />}
        title="敏感消息先审核"
        desc="涉及敏感内容的消息需人工审核后回复"
        right={<Switch checked={settings.sensitive_message_review} disabled={pending} onChange={setSensitiveReview} />}
      />
      {safetyRuleGroups.map((group) => (
        <SettingRow
          key={group.id}
          iconBg={group.id === "business_risk" ? "bg-amber-500" : "bg-rose-500"}
          icon={<ShieldAlert className="h-5 w-5 text-white" />}
          title={group.title}
          desc={group.desc}
          right={
            <Switch
              checked={isRuleGroupEnabled(group.id)}
              disabled={pending}
              onChange={(value) => setRuleGroup(group.id, value)}
            />
          }
        />
      ))}
      <SettingRow
        iconBg="bg-slate-600"
        icon={<RotateCcw className="h-5 w-5 text-white" />}
        title="恢复默认安全策略"
        desc="恢复提示词注入、敏感信息、业务风险的默认规则组配置"
        right={<IconButton label="恢复默认" disabled={pending} onClick={resetSafetyPolicy} />}
      />
      <SafetyPatternManager
        inputRules={settings.safety_policy.input_rules}
        outputRules={settings.safety_policy.output_rules}
        drafts={safetyPatternDrafts}
        pending={pending}
        onDraftChange={(ruleId, value) => setSafetyPatternDrafts((current) => ({ ...current, [ruleId]: value }))}
        onAdd={addSafetyPattern}
        onRemove={removeSafetyPattern}
      />
      <SafetyPolicyImportExportPanel
        value={safetyPolicyJson}
        error={safetyPolicyJsonError}
        pending={pending}
        onChange={setSafetyPolicyJson}
        onExport={exportSafetyPolicy}
        onImport={submitSafetyPolicyImport}
      />
    </>
  )
}

function SafetyPatternManager({
  inputRules,
  outputRules,
  drafts,
  pending,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  inputRules: SafetyPatternRule[]
  outputRules: SafetyPatternRule[]
  drafts: Record<string, string>
  pending: boolean
  onDraftChange: (ruleId: string, value: string) => void
  onAdd: (rule: SafetyPatternRule) => void
  onRemove: (rule: SafetyPatternRule, pattern: string) => void
}) {
  return (
    <SettingRow
      iconBg="bg-slate-600"
      icon={<ShieldAlert className="h-5 w-5 text-white" />}
      title="安全词管理"
      desc="按安全类别维护输入和输出拦截词"
      right={
        <Dialog>
          <DialogTrigger asChild>
            <IconButton label="设置" disabled={pending} onClick={() => undefined} />
          </DialogTrigger>
          <DialogContent className="max-h-[82vh] max-w-[860px] overflow-hidden p-0">
            <DialogHeader className="border-b border-slate-200 px-5 py-4">
              <DialogTitle className="text-base text-slate-900">安全词管理</DialogTitle>
              <DialogDescription>按输入、输出方向维护拦截词，保存后会影响后续回复审核。</DialogDescription>
            </DialogHeader>
            <div className="max-h-[66vh] overflow-y-auto px-5 py-4">
              <div className="space-y-5">
                {safetyRuleGroups.map((group) => {
                  const rules = [...inputRules, ...outputRules].filter((rule) => rule.rule_group === group.id)
                  return (
                    <section key={group.id} className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-medium text-slate-800">{group.title}</h4>
                          <p className="mt-0.5 text-xs text-slate-500">{group.desc}</p>
                        </div>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                          {rules.reduce((total, rule) => total + rule.patterns.length, 0)} 条
                        </span>
                      </div>
                      <div className="grid gap-3 xl:grid-cols-2">
                        {rules.map((rule) => (
                          <SafetyRulePatternEditor
                            key={rule.rule_id}
                            rule={rule}
                            direction={inputRules.some((inputRule) => inputRule.rule_id === rule.rule_id) ? "输入" : "输出"}
                            draft={drafts[rule.rule_id] ?? ""}
                            pending={pending}
                            onDraftChange={(value) => onDraftChange(rule.rule_id, value)}
                            onAdd={() => onAdd(rule)}
                            onRemove={(pattern) => onRemove(rule, pattern)}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    />
  )
}

function SafetyRulePatternEditor({
  rule,
  direction,
  draft,
  pending,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  rule: SafetyPatternRule
  direction: "输入" | "输出"
  draft: string
  pending: boolean
  onDraftChange: (value: string) => void
  onAdd: () => void
  onRemove: (pattern: string) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{direction}</span>
        <span className="rounded-md bg-white px-2 py-1 text-xs text-slate-500">{formatSafetyRuleCode(rule.reason_code || rule.rule_id)}</span>
        <span className="rounded-md bg-white px-2 py-1 text-xs text-slate-500">{formatSafetyMatchType(rule.match_type)}</span>
        {!rule.enabled ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">已停用</span> : null}
      </div>
      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={draft}
          disabled={pending}
          placeholder="新增安全词"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onAdd()
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={pending || !draft.trim()}
          onClick={onAdd}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`新增安全词到 ${formatSafetyRuleCode(rule.reason_code || rule.rule_id)}`}
          title="新增安全词"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex max-h-24 flex-wrap gap-2 overflow-hidden">
        {rule.patterns.length ? (
          rule.patterns.map((pattern) => (
            <span
              key={pattern}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
            >
              <span className="min-w-0 truncate">{pattern}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => onRemove(pattern)}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`删除 ${pattern}`}
                title="删除安全词"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        ) : (
          <p className="text-xs text-slate-500">暂无安全词。</p>
        )}
      </div>
    </div>
  )
}

function formatSafetyRuleCode(code: string) {
  const normalized = code.toLowerCase()
  if (normalized === "prompt_injection" || normalized.includes("prompt")) return "提示词注入"
  if (normalized === "sensitive_information" || normalized.includes("sensitive")) return "敏感信息"
  if (normalized === "business_risk" || normalized.includes("business")) return "业务风险"
  if (normalized.includes("keyword")) return "关键词匹配"
  if (normalized.includes("regex")) return "规则匹配"
  return code || "-"
}

function formatSafetyMatchType(matchType: string) {
  const normalized = matchType.toLowerCase()
  if (normalized === "keyword") return "关键词"
  if (normalized === "regex") return "正则规则"
  if (normalized === "contains") return "包含匹配"
  return matchType || "-"
}

function SafetyPolicyImportExportPanel({
  value,
  error,
  pending,
  onChange,
  onExport,
  onImport,
}: {
  value: string
  error: string
  pending: boolean
  onChange: (value: string) => void
  onExport: () => void
  onImport: () => void
}) {
  return (
    <SettingRow
      iconBg="bg-slate-600"
      icon={<FileClock className="h-5 w-5 text-white" />}
      title="安全策略备份"
      desc="导出或导入安全策略配置文本"
      right={
        <Dialog>
          <DialogTrigger asChild>
            <IconButton label="设置" disabled={pending} onClick={() => undefined} />
          </DialogTrigger>
          <DialogContent className="max-h-[82vh] max-w-[760px] overflow-hidden p-0">
            <DialogHeader className="border-b border-slate-200 px-5 py-4">
              <DialogTitle className="text-base text-slate-900">安全策略备份</DialogTitle>
              <DialogDescription>可导出当前安全策略，也可粘贴配置文本后导入恢复。</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 py-4">
              <div className="flex justify-end gap-2">
                <IconButton label="导出配置" disabled={pending} onClick={onExport} />
                <IconButton label="导入配置" disabled={pending} onClick={onImport} />
              </div>
              <textarea
                value={value}
                disabled={pending}
                spellCheck={false}
                onChange={(event) => onChange(event.target.value)}
                className="min-h-[240px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
              />
              {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
            </div>
          </DialogContent>
        </Dialog>
      }
    />
  )
}

function CustomerSettings({
  settings,
  pending,
  updateSettings,
}: {
  settings: Settings
  pending: boolean
  updateSettings: (patch: SettingsPatch, successMessage?: string) => void
}) {
  return (
    <>
      <SettingRow
        iconBg="bg-orange-500"
        icon={<UserPlus className="h-5 w-5 text-white" />}
        title="新客户自动建档"
        desc="从新会话中自动生成客户初始档案"
        right={<Switch checked={settings.new_customer_auto_create} disabled={pending} onChange={(value) => updateSettings({ new_customer_auto_create: value })} />}
      />
      <SettingRow
        iconBg="bg-rose-500"
        icon={<ShieldBan className="h-5 w-5 text-white" />}
        title="黑名单数量"
        desc="黑名单会话不会自动回复"
        right={<DropdownValue>{settings.blacklist.length} 个</DropdownValue>}
      />
      <SettingRow
        iconBg="bg-slate-600"
        icon={<UserPlus className="h-5 w-5 text-white" />}
        title="人工接管会话"
        desc="人工接管后该会话由客服手动处理"
        right={<DropdownValue>{settings.human_takeover_sessions.length} 个</DropdownValue>}
      />
    </>
  )
}

function AdvancedSettings({
  settings,
  privacy,
  desktopPreferences,
  desktopShellAvailable,
  pending,
  updateSettings,
  updatePrivacy,
  updateDesktopPreferences,
}: {
  settings: Settings
  privacy: PrivacyPolicy
  desktopPreferences: DesktopShellPreferences | null
  desktopShellAvailable: boolean
  pending: boolean
  updateSettings: (patch: SettingsPatch, successMessage?: string) => void
  updatePrivacy: (patch: Partial<PrivacyPolicy>, successMessage?: string) => void
  updateDesktopPreferences: (patch: Partial<DesktopShellPreferences>, successMessage?: string) => void
}) {
  return (
    <>
      <SettingRow
        iconBg="bg-slate-600"
        icon={<Power className="h-5 w-5 text-white" />}
        title="后台静默运行"
        desc="关闭窗口后保持守护服务继续运行"
        right={<Switch checked={settings.run_silently} disabled={pending} onChange={(value) => updateSettings({ run_silently: value })} />}
      />
      <SettingRow
        iconBg="bg-rose-500"
        icon={<ShieldAlert className="h-5 w-5 text-white" />}
        title="强制停止热键"
        desc="运行中可随时按下该热键强制停止自动回复，输入 off 可关闭"
        right={
          <TextInput
            value={settings.force_stop_hotkey || "ctrl+shift+f12"}
            disabled={pending}
            placeholder="ctrl+shift+f12"
            onChange={(value) => updateSettings({ force_stop_hotkey: value.trim() || "off" }, "强制停止热键已保存")}
          />
        }
      />
      <SettingRow
        iconBg="bg-emerald-500"
        icon={<Power className="h-5 w-5 text-white" />}
        title="开机自启"
        desc={desktopShellAvailable ? "系统启动后自动拉起桌面应用" : "仅在 Electron 桌面应用内可编辑"}
        right={
          <Switch
            checked={desktopPreferences?.launchAtLogin ?? false}
            disabled={pending || !desktopShellAvailable || !desktopPreferences}
            onChange={(value) => updateDesktopPreferences({ launchAtLogin: value })}
          />
        }
      />
      <SettingRow
        iconBg="bg-amber-500"
        icon={<Clock className="h-5 w-5 text-white" />}
        title="定时巡检间隔"
        desc={desktopShellAvailable ? "桌面壳每隔 N 秒向后端发起一次 schedule tick" : "仅在 Electron 桌面应用内可编辑"}
        right={
          <NumberInput
            value={desktopPreferences?.scheduleTickIntervalSeconds ?? 60}
            min={15}
            max={3600}
            suffix="秒"
            disabled={pending || !desktopShellAvailable || !desktopPreferences}
            onChange={(value) => updateDesktopPreferences({ scheduleTickIntervalSeconds: value })}
          />
        }
      />
      <SettingRow
        iconBg="bg-blue-500"
        icon={<DatabaseBackup className="h-5 w-5 text-white" />}
        title="知识库分块大小"
        desc="影响本地向量库构建粒度"
        right={<NumberInput value={settings.knowledge_chunk_size} min={100} max={20000} disabled={pending} onChange={(value) => updateSettings({ knowledge_chunk_size: value })} />}
      />
      <SettingRow
        iconBg="bg-violet-500"
        icon={<DatabaseBackup className="h-5 w-5 text-white" />}
        title="分块重叠长度"
        desc="适当重叠可提升检索上下文连续性"
        right={<NumberInput value={settings.knowledge_chunk_overlap} min={0} max={5000} disabled={pending} onChange={(value) => updateSettings({ knowledge_chunk_overlap: value })} />}
      />
      <SettingRow
        iconBg="bg-rose-500"
        icon={<ShieldAlert className="h-5 w-5 text-white" />}
        title="记忆保留天数"
        desc="超过期限的记忆数据会在保留策略中清理"
        right={<NumberInput value={privacy.memory_retention_days} min={1} max={3650} disabled={pending} suffix="天" onChange={(value) => updatePrivacy({ memory_retention_days: value })} />}
      />
      <SettingRow
        iconBg="bg-slate-600"
        icon={<FileClock className="h-5 w-5 text-white" />}
        title="日志保留天数"
        desc="自动清理过期日志，降低本地敏感数据残留"
        right={<NumberInput value={privacy.log_retention_days} min={1} max={365} disabled={pending} suffix="天" onChange={(value) => updatePrivacy({ log_retention_days: value })} />}
      />
    </>
  )
}

function SettingRow({
  icon,
  iconBg,
  title,
  desc,
  right,
}: {
  icon: ReactNode
  iconBg: string
  title: string
  desc: string
  right: ReactNode
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="mt-0.5 text-xs text-slate-500">{desc}</div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  )
}

function DropdownValue({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
      {children}
      <ChevronDown className="h-4 w-4 text-slate-400" />
    </div>
  )
}

function SelectValue({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string
  options: readonly string[]
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function TimeInput({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-[112px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
    />
  )
}

function TextInput({
  value,
  disabled,
  placeholder,
  onChange,
}: {
  value: string
  disabled?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-[168px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-400 disabled:opacity-60"
    />
  )
}

function NumberInput({
  value,
  min,
  max,
  suffix,
  disabled,
  onChange,
}: {
  value: number
  min: number
  max: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus-within:border-blue-400">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-20 bg-transparent text-right outline-none disabled:opacity-60"
      />
      {suffix ? <span className="text-xs text-slate-400">{suffix}</span> : null}
    </label>
  )
}

function IconButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RotateCcw className="h-4 w-4 text-slate-500" />
      {label}
    </button>
  )
}

function Switch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-blue-500" : "bg-slate-200",
      )}
    >
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  )
}
