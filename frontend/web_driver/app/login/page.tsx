"use client"

import type React from "react"
import { Suspense } from "react"

import { Header } from "@/components/header"
import { useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { driverLogin } from "@/lib/auth/client"

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await driverLogin(email, password)
      if (!result.ok) {
        setError(result.message)
        return
      }
      const next = searchParams.get("next")
      router.push(next || "/app")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-lg p-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-secondary mb-8">Sign in to your RideHub driver account</p>

            {error && (
              <div className="bg-card border border-red-500/40 text-foreground rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder-secondary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Signing In..." : "Sign In"}
              </button>
            </form>

            <p className="text-center text-secondary mt-8">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary font-semibold hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="px-4 py-8">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  )
}
