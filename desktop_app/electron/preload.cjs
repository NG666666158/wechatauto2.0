const { contextBridge, ipcRenderer, webUtils } = require("electron")

const shellApi = {
  getPreferences: () => ipcRenderer.invoke("shell-preferences:get"),
  updatePreferences: (patch) => ipcRenderer.invoke("shell-preferences:update", patch || {}),
  ensureBackend: () => ipcRenderer.invoke("backend:ensure"),
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  toggleMaximizeWindow: () => ipcRenderer.invoke("window:toggle-maximize"),
  closeWindowToTray: () => ipcRenderer.invoke("window:close-to-tray"),
  selectKnowledgeFiles: () => ipcRenderer.invoke("knowledge:select-files"),
  getPathForFile: (file) => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld("wechatDesktopShell", shellApi)
contextBridge.exposeInMainWorld("electronShell", shellApi)
