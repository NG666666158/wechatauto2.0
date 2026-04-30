import type { ReactNode } from "react"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface WindowChromeProps {
  title?: string
  rightSlot?: ReactNode
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function WindowChrome({ title, rightSlot, collapsed = false, onToggleCollapse }: WindowChromeProps) {
  return (
    <div
      className={cn(
        "app-drag-region relative flex h-16 items-center bg-[var(--app-sidebar-bg)] transition-[padding] duration-300 ease-out",
        collapsed ? "justify-center px-0" : "px-7",
      )}
    >
      <div
        className={cn(
          "app-no-drag flex items-center gap-2.5 overflow-hidden transition-[opacity,width] duration-300 ease-out",
          collapsed ? "w-0 opacity-0" : "w-[62px] opacity-100",
        )}
      >
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full bg-[#ff5f56] transition-[opacity,width,transform] duration-300 ease-out",
            collapsed ? "w-0 -translate-x-2 opacity-0" : "opacity-100",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full bg-[#ffbd2e] transition-[opacity,width,transform] duration-300 ease-out",
            collapsed ? "w-0 -translate-x-2 opacity-0" : "opacity-100",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "h-3.5 w-3.5 shrink-0 rounded-full bg-[#27c93f] transition-[opacity,width,transform] duration-300 ease-out",
            collapsed ? "w-0 -translate-x-2 opacity-0" : "opacity-100",
          )}
          aria-hidden
        />
      </div>
      {onToggleCollapse ? (
        <button
          type="button"
          className={cn(
            "app-no-drag absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--app-card-border)] bg-white text-slate-500 shadow-sm transition-[left,background-color,color,transform] duration-300 ease-out hover:bg-[var(--app-nav-active-bg)] hover:text-[var(--app-nav-active-text)]",
            collapsed ? "left-1/2 -translate-x-1/2" : "left-[104px]",
          )}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      ) : null}
      {title ? <div className="ml-8 text-[22px] font-bold text-[var(--app-title)]">{title}</div> : null}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  )
}
