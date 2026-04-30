export type DesktopShellPreferences = {
  launchAtLogin: boolean
  scheduleTickIntervalSeconds: number
}

type DesktopShellPatch = Partial<DesktopShellPreferences>

type ElectronShellApi = {
  getPreferences: () => Promise<DesktopShellPreferences>
  updatePreferences: (patch: DesktopShellPatch) => Promise<DesktopShellPreferences>
  ensureBackend?: () => Promise<DesktopBackendSession>
  minimizeWindow?: () => Promise<boolean>
  toggleMaximizeWindow?: () => Promise<boolean>
  closeWindowToTray?: () => Promise<boolean>
  selectKnowledgeFiles?: () => Promise<string[]>
  getPathForFile?: (file: File) => string
}

export type DesktopBackendSession = {
  baseUrl: string
  managed: boolean
  reused: boolean
}

declare global {
  interface Window {
    electronShell?: ElectronShellApi
    wechatDesktopShell?: ElectronShellApi
  }
}

export function getDesktopShellBridge() {
  const bridge = typeof window === "undefined" ? undefined : window.electronShell || window.wechatDesktopShell

  return {
    isAvailable() {
      return Boolean(bridge)
    },
    async getPreferences(): Promise<DesktopShellPreferences | null> {
      if (!bridge) {
        return null
      }
      return bridge.getPreferences()
    },
    async updatePreferences(patch: DesktopShellPatch): Promise<DesktopShellPreferences | null> {
      if (!bridge) {
        return null
      }
      return bridge.updatePreferences(patch)
    },
    async ensureBackend(): Promise<DesktopBackendSession | null> {
      if (!bridge?.ensureBackend) {
        return null
      }
      return bridge.ensureBackend()
    },
    async minimizeWindow(): Promise<boolean> {
      if (!bridge?.minimizeWindow) {
        return false
      }
      return Boolean(await bridge.minimizeWindow())
    },
    async toggleMaximizeWindow(): Promise<boolean> {
      if (!bridge?.toggleMaximizeWindow) {
        return false
      }
      return Boolean(await bridge.toggleMaximizeWindow())
    },
    async closeWindowToTray(): Promise<boolean> {
      if (!bridge?.closeWindowToTray) {
        return false
      }
      return Boolean(await bridge.closeWindowToTray())
    },
    async selectKnowledgeFiles(): Promise<string[]> {
      if (!bridge?.selectKnowledgeFiles) {
        return []
      }
      try {
        return await bridge.selectKnowledgeFiles()
      } catch {
        return []
      }
    },
    getPathForFile(file: File): string {
      const fallbackPath = (file as File & { path?: string }).path || ""
      if (!bridge?.getPathForFile) {
        return fallbackPath
      }
      try {
        return bridge.getPathForFile(file) || fallbackPath
      } catch {
        return fallbackPath
      }
    },
  }
}

export async function selectKnowledgeFiles(): Promise<string[]> {
  return getDesktopShellBridge().selectKnowledgeFiles()
}

export function getPathForFile(file: File): string {
  return getDesktopShellBridge().getPathForFile(file)
}
