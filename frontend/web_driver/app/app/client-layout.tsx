"use client"

import type React from "react"

import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { useEffect, useState } from "react"
import { Menu } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { getSession } from "@/lib/auth/client"

export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [authChecked, setAuthChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const session = await getSession()
      if (!session.authenticated) {
        router.replace(`/login/?next=${encodeURIComponent(pathname || "/app")}`)
        return
      }

      if (mounted) setAuthChecked(true)
    })().catch(() => {
      router.replace(`/login/?next=${encodeURIComponent(pathname || "/app")}`)
    })

    return () => {
      mounted = false
    }
  }, [router, pathname])

  if (!authChecked) return null

  return (
    <div className="flex h-screen">
      <DashboardSidebar />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 md:hidden z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <div className="md:hidden flex items-center justify-between bg-card border-b border-border px-4 py-4 sticky top-0 z-30">
          <h1 className="text-xl font-bold text-primary">RideHub</h1>
          <button onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
