"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Car, History, User, MapPin } from "lucide-react"

export function Navigation() {
  const pathname = usePathname()
  const isAppPage = pathname?.startsWith("/app")

  if (!isAppPage) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Car className="h-6 w-6" />
            <span className="text-xl font-bold">RideGo</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing">
              <Button variant="ghost">Pricing</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/app/book" className="flex items-center gap-2">
          <Car className="h-6 w-6" />
          <span className="text-xl font-bold">RideGo</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/app/book">
            <Button variant={pathname === "/app/book" ? "default" : "ghost"} size="sm" className="gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Book</span>
            </Button>
          </Link>
          <Link href="/app/history">
            <Button variant={pathname === "/app/history" ? "default" : "ghost"} size="sm" className="gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
          </Link>
          <Link href="/app/profile">
            <Button variant={pathname === "/app/profile" ? "default" : "ghost"} size="sm" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
