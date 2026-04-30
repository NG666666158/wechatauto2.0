"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import type { AppThemeKey } from "@/lib/themes"
import { AppSidebar } from "./app-sidebar"
import { WindowChrome } from "./window-chrome"
import { WindowControls } from "./window-controls"

interface AppShellProps {
  title: string
  headerRight?: ReactNode
  children: ReactNode
  theme?: AppThemeKey
}

export function AppShell({ title, headerRight, children, theme = "classic" }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.localStorage.getItem("wechat-ai-sidebar-collapsed") === "1"
  })

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((value) => {
      const next = !value
      window.localStorage.setItem("wechat-ai-sidebar-collapsed", next ? "1" : "0")
      return next
    })
  }

  return (
    <div className={`app-theme app-theme-${theme} h-screen overflow-hidden bg-[var(--app-shell-bg)] text-[var(--app-text)]`}>
      <div className="flex h-full min-h-0">
        <div
          className={`shrink-0 bg-[var(--app-sidebar-bg)] transition-[width] duration-300 ease-out ${
            sidebarCollapsed ? "w-[56px]" : "w-[168px]"
          }`}
        >
          <WindowChrome collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebarCollapsed} />
          <AppSidebar collapsed={sidebarCollapsed} />
        </div>

        <div className="relative w-px shrink-0">
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--app-divider)] to-transparent" />
          <div className="absolute inset-y-24 left-[-1px] w-[3px] rounded-full bg-gradient-to-b from-transparent via-[var(--app-divider-glow)] to-transparent" />
        </div>

        <main className="relative flex min-w-0 flex-1 flex-col bg-[var(--app-content-bg)]">
          <WindowControls />
          <div className="app-drag-region flex h-16 shrink-0 items-center justify-between bg-[var(--app-surface)] px-7">
            <h1 className="text-[22px] font-bold text-[var(--app-title)]">{title}</h1>
            {headerRight ? <div className="app-no-drag pr-32">{headerRight}</div> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}
