"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, Home, ListTodo, MessageSquare, Settings, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "\u9996\u9875", href: "/", icon: Home },
  { label: "\u6d88\u606f", href: "/messages", icon: MessageSquare },
  { label: "\u5f85\u5904\u7406", href: "/pending", icon: ListTodo },
  { label: "\u5ba2\u6237", href: "/customers", icon: User },
  { label: "\u77e5\u8bc6\u5e93", href: "/knowledge", icon: BookOpen },
  { label: "\u8bbe\u7f6e", href: "/settings", icon: Settings },
]

interface AppSidebarProps {
  collapsed?: boolean
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "shrink-0 bg-[var(--app-sidebar-bg)] py-2 transition-[width,padding] duration-300 ease-out",
        collapsed ? "w-[56px] px-1.5" : "w-[168px] px-3",
      )}
    >
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex h-12 items-center overflow-hidden rounded-lg text-[17px] transition-[background-color,color,padding,gap] duration-300 ease-out",
                collapsed ? "justify-center gap-0 px-0" : "gap-3 px-3",
                active
                  ? "bg-[var(--app-nav-active-bg)] font-bold text-[var(--app-nav-active-text)]"
                  : "font-semibold text-[var(--app-nav-text)] hover:bg-[var(--app-nav-hover-bg)]",
              )}
            >
              <Icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2.4 : 1.9} />
              <span
                className={cn(
                  "whitespace-nowrap transition-[opacity,width,transform] duration-300 ease-out",
                  collapsed ? "w-0 translate-x-2 opacity-0" : "w-[72px] translate-x-0 opacity-100",
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
