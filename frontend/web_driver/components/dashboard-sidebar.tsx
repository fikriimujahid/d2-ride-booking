"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, TrendingUp, Navigation, User, LogOut } from "lucide-react"
import { driverLogout } from "@/lib/auth/client"

export function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const navItems = [
    { label: "Dashboard", href: "/app", icon: LayoutDashboard },
    { label: "Earnings", href: "/app/earnings", icon: TrendingUp },
    { label: "Trips", href: "/app/trips", icon: Navigation },
    { label: "Profile", href: "/app/profile", icon: User },
  ]

  const isActive = (href: string) => {
    if (href === "/app") {
      return pathname === "/app"
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="hidden md:flex w-64 bg-card border-r border-border flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-2xl font-bold text-primary">RideHub</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active ? "bg-primary text-white" : "text-secondary hover:bg-border hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border">
        <button
          onClick={async () => {
            await driverLogout()
            router.push("/login")
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-secondary hover:bg-border hover:text-foreground transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}
