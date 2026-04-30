const path = require("node:path")
const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, net, protocol } = require("electron")

const { ensureBackendSession, probeBackend } = require("./backend-controller.cjs")
const { registerPackagedFrontendProtocol } = require("./frontend-protocol.cjs")
const { createWindowCloseHandler, shutdownDesktopShell } = require("./lifecycle-controller.cjs")
const { buildTrayTemplate, handleEscAction, loadShellState, runScheduleTick } = require("./shell-controller.cjs")
const { loadShellPreferences, saveShellPreferences, syncLaunchAtLogin } = require("./shell-preferences.cjs")
const { createShellPreferencesBridge } = require("./shell-preferences-bridge.cjs")
const { attachWindowDiagnostics } = require("./window-diagnostics.cjs")
const { attachWindowVisibilityGuards } = require("./window-visibility-controller.cjs")

const repoRoot = path.resolve(__dirname, "..", "..")
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

const frontendUrl = process.env.WECHAT_AI_FRONTEND_URL
  || (app.isPackaged ? "app://frontend/index.html" : "http://127.0.0.1:3000")
const backendPort = Number(process.env.WECHAT_AI_BACKEND_PORT || 8765)
const APP_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="bg" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#293241"/>
      <stop offset="1" stop-color="#121826"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="29" fill="url(#bg)"/>
  <circle cx="32" cy="32" r="23" fill="none" stroke="#5eead4" stroke-width="2" opacity=".35"/>
  <path d="M31.6 15.5c5.6 3.3 9.6 8.1 11.8 14.4" fill="none" stroke="#dbeafe" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M47.2 36.2c-3.1 6.2-8.1 10.3-15 12.3" fill="none" stroke="#dbeafe" stroke-width="3.2" stroke-linecap="round"/>
  <path d="M17.3 38.7c-1.4-6.5-.2-12.4 3.8-17.6" fill="none" stroke="#dbeafe" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="32" cy="32" r="7.4" fill="#0f172a" stroke="#93c5fd" stroke-width="2.6"/>
  <circle cx="24" cy="21" r="4.1" fill="#60a5fa"/>
  <circle cx="46" cy="34" r="4.1" fill="#34d399"/>
  <circle cx="21" cy="43" r="4.1" fill="#f8fafc"/>
</svg>`
const KNOWLEDGE_FILE_FILTERS = [
  { name: "Knowledge documents", extensions: ["txt", "md", "markdown", "docx", "pdf", "json", "csv", "html"] },
  { name: "Text and Markdown", extensions: ["txt", "md", "markdown"] },
  { name: "Office and PDF", extensions: ["docx", "pdf"] },
  { name: "Structured text", extensions: ["json", "csv", "html"] },
]

const shellState = {
  backendSession: null,
  mainWindow: null,
  tray: null,
  scheduleTimer: null,
  isQuitting: false,
  shutdownStarted: false,
  runSilently: true,
  escAction: "pause",
  scheduleEnabled: false,
  shellPreferences: null,
}

const fallbackTrayState = {
  tooltip: "客户版微信自动回复桌面应用",
  menu_items: [
    { item_id: "show", label: "显示主界面", action: "show_window", enabled: true },
    { item_id: "exit", label: "退出应用", action: "exit_app", enabled: true },
  ],
}

function createAppIcon(size = 32) {
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(APP_ICON_SVG).toString("base64")}`
  const icon = nativeImage.createFromDataURL(dataUrl)
  return icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: size, height: size })
}

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 810,
    minWidth: 1180,
    minHeight: 664,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: "#fbfdff",
    icon: createAppIcon(64),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  })

  mainWindow.webContents.on("before-input-event", async (_event, input) => {
    if (input.type === "keyDown" && input.key === "Escape") {
      await handleEscAction(buildShellContext())
    }
  })

  mainWindow.on(
    "close",
    createWindowCloseHandler({
      isQuitting: () => shellState.isQuitting,
      shouldHideOnClose: () => shellState.runSilently,
      hideWindow: () => mainWindow.hide(),
      requestAppQuit: () => app.quit(),
    }),
  )

  attachWindowDiagnostics(mainWindow)
  attachWindowVisibilityGuards(mainWindow)
  mainWindow.loadURL(frontendUrl)
  return mainWindow
}

async function syncShellPreferences() {
  if (!shellState.backendSession || !shellState.backendSession.baseUrl) {
    return
  }
  const shellData = await loadShellState(shellState.backendSession.baseUrl)
  shellState.scheduleEnabled = Boolean(shellData.settings && shellData.settings.schedule_enabled)
  shellState.runSilently = shellData.preferences.runSilently
  shellState.escAction = shellData.preferences.escAction
  await refreshTray(shellData.trayState)
  ensureScheduleTimer()
}

async function refreshTray(existingTrayState = null) {
  const trayState = existingTrayState || (
    shellState.backendSession && shellState.backendSession.baseUrl
      ? (await loadShellState(shellState.backendSession.baseUrl)).trayState
      : fallbackTrayState
  )
  if (!shellState.tray) {
    shellState.tray = new Tray(createAppIcon(16))
    shellState.tray.on("double-click", () => {
      if (shellState.mainWindow) {
        shellState.mainWindow.show()
        shellState.mainWindow.focus()
      }
    })
  } else {
    shellState.tray.setImage(createAppIcon(16))
  }
  shellState.tray.setToolTip(String(trayState.tooltip || "WeChat AI"))
  shellState.tray.setContextMenu(Menu.buildFromTemplate(buildTrayTemplate(trayState, buildShellContext())))
}

function buildShellContext() {
  return {
    baseUrl: shellState.backendSession ? shellState.backendSession.baseUrl : "",
    runSilently: shellState.runSilently,
    escAction: shellState.escAction,
    showWindow: () => {
      if (shellState.mainWindow) {
        shellState.mainWindow.show()
        shellState.mainWindow.focus()
      }
    },
    hideWindow: () => {
      if (shellState.mainWindow) {
        shellState.mainWindow.hide()
      }
    },
    requestAppQuit: () => app.quit(),
    refreshTray: async () => {
      await syncShellPreferences()
    },
  }
}

function ensureScheduleTimer() {
  if (shellState.scheduleTimer) {
    clearInterval(shellState.scheduleTimer)
    shellState.scheduleTimer = null
  }
  const preferences = shellState.shellPreferences || { scheduleTickIntervalSeconds: 60 }
  if (!shellState.scheduleEnabled) {
    return
  }
  shellState.scheduleTimer = setInterval(async () => {
    try {
      await runScheduleTick(buildShellContext())
    } catch {
      // Ignore schedule tick failures in the shell loop and keep the app alive.
    }
  }, Math.max(Number(preferences.scheduleTickIntervalSeconds || 60), 15) * 1000)
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.wechatauto.desktop")
  }
  if (app.isPackaged) {
    registerPackagedFrontendProtocol({
      protocol,
      net,
      frontendRoot: path.join(process.resourcesPath, "frontend", "out"),
    })
  }
  shellState.shellPreferences = loadShellPreferences(app.getPath("userData"))
  syncLaunchAtLogin(app, shellState.shellPreferences)
  const shellPreferencesBridge = createShellPreferencesBridge({
    appAdapter: app,
    baseDir: app.getPath("userData"),
    loadPreferences: loadShellPreferences,
    savePreferences: saveShellPreferences,
    syncLaunchAtLogin,
    onPreferencesChanged: (nextPreferences) => {
      shellState.shellPreferences = nextPreferences
      ensureScheduleTimer()
    },
  })
  ipcMain.handle("shell-preferences:get", () => shellPreferencesBridge.getPreferences())
  ipcMain.handle("shell-preferences:update", (_event, patch) => shellPreferencesBridge.updatePreferences(patch))
  ipcMain.handle("window:minimize", () => {
    if (shellState.mainWindow) {
      shellState.mainWindow.minimize()
    }
    return true
  })
  ipcMain.handle("window:toggle-maximize", () => {
    if (!shellState.mainWindow) {
      return false
    }
    if (shellState.mainWindow.isMaximized()) {
      shellState.mainWindow.unmaximize()
      return false
    }
    shellState.mainWindow.maximize()
    return true
  })
  ipcMain.handle("window:close-to-tray", () => {
    if (shellState.mainWindow) {
      shellState.mainWindow.hide()
    }
    return true
  })
  ipcMain.handle("knowledge:select-files", async () => {
    const result = await dialog.showOpenDialog(shellState.mainWindow || undefined, {
      title: "Select knowledge files",
      properties: ["openFile", "multiSelections"],
      filters: KNOWLEDGE_FILE_FILTERS,
    })
    if (result.canceled) {
      return []
    }
    return result.filePaths
  })
  ipcMain.handle("backend:ensure", async () => {
    if (
      shellState.backendSession &&
      shellState.backendSession.baseUrl &&
      (await probeBackend(shellState.backendSession.baseUrl))
    ) {
      return {
        baseUrl: shellState.backendSession.baseUrl,
        managed: Boolean(shellState.backendSession.managed),
        reused: true,
      }
    }
    shellState.backendSession = await ensureBackendSession({
      repoRoot,
      resourcesPath: process.resourcesPath,
      dataRoot: path.join(app.getPath("userData"), "data"),
      host: "127.0.0.1",
      port: backendPort,
      startupTimeoutMs: 30000,
      pollIntervalMs: 1000,
    })
    await syncShellPreferences()
    return {
      baseUrl: shellState.backendSession.baseUrl,
      managed: Boolean(shellState.backendSession.managed),
      reused: Boolean(shellState.backendSession.reused),
    }
  })
  shellState.mainWindow = createMainWindow()
  await refreshTray(fallbackTrayState)
})

app.on("activate", () => {
  if (shellState.mainWindow) {
    shellState.mainWindow.show()
    return
  }
  shellState.mainWindow = createMainWindow()
})

app.on("window-all-closed", (event) => {
  if (process.platform === "darwin") {
    return
  }
  event.preventDefault()
})

app.on("before-quit", async (event) => {
  if (shellState.shutdownStarted) {
    return
  }
  shellState.shutdownStarted = true
  shellState.isQuitting = true
  event.preventDefault()
  try {
    await shutdownDesktopShell({
      backendSession: shellState.backendSession,
    })
  } finally {
    if (shellState.scheduleTimer) {
      clearInterval(shellState.scheduleTimer)
      shellState.scheduleTimer = null
    }
    if (shellState.tray) {
      shellState.tray.destroy()
      shellState.tray = null
    }
    app.exit(0)
  }
})

module.exports = {}
