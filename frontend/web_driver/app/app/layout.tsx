import type React from "react"
import ClientDashboardLayout from "./client-layout"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClientDashboardLayout>{children}</ClientDashboardLayout>
}
