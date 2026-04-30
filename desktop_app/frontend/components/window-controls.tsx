"use client"

import { Minus, Square, X } from "lucide-react"
import { getDesktopShellBridge } from "@/lib/electron-shell"

export function WindowControls() {
  const shell = getDesktopShellBridge()

  if (!shell.isAvailable()) {
    return null
  }

  return (
    <div className="app-no-drag fixed right-0 top-0 z-[90] flex h-10 items-stretch">
      <button
        type="button"
        className="app-no-drag flex h-10 w-12 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        aria-label="最小化"
        title="最小化"
        onClick={() => void shell.minimizeWindow()}
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="app-no-drag flex h-10 w-12 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        aria-label="最大化或还原"
        title="最大化或还原"
        onClick={() => void shell.toggleMaximizeWindow()}
      >
        <Square className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className="app-no-drag flex h-10 w-12 items-center justify-center text-slate-500 transition-colors hover:bg-rose-500 hover:text-white"
        aria-label="关闭到后台"
        title="关闭到后台"
        onClick={() => void shell.closeWindowToTray()}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
