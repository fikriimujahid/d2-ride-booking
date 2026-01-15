"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { authStore } from "@/lib/auth/auth.store"

export function SignOutButton() {
  const router = useRouter()

  const onClick = async () => {
    await authStore.logoutBestEffort()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-destructive/50 p-4 text-left text-destructive transition-colors hover:bg-destructive/10"
    >
      <div className="flex items-center gap-3">
        <LogOut className="h-5 w-5" />
        <div>
          <p className="font-medium">Sign Out</p>
          <p className="text-sm opacity-70">Log out of your account</p>
        </div>
      </div>
    </button>
  )
}
