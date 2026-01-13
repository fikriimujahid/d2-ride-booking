"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function MatchingPage() {
  const router = useRouter()

  useEffect(() => {
    // Simulate driver matching - redirect after 3 seconds
    const timer = setTimeout(() => {
      router.push("/app/trip")
    }, 3000)

    return () => clearTimeout(timer)
  }, [router])

  const handleCancel = () => {
    router.push("/app/book")
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-accent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-8 w-8 rounded-full bg-background" />
                </div>
              </div>
            </div>
            <h1 className="mb-2 text-2xl font-bold">Finding your driver</h1>
            <p className="mb-6 text-muted-foreground">
              We&apos;re matching you with the best available driver in your area...
            </p>

            {/* Progress indicators */}
            <div className="mb-8 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                <span className="text-sm text-muted-foreground">Searching for nearby drivers</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-2 rounded-full bg-muted"
                  style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 0.5s infinite" }}
                />
                <span className="text-sm text-muted-foreground">Calculating optimal route</span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-2 w-2 rounded-full bg-muted"
                  style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) 1s infinite" }}
                />
                <span className="text-sm text-muted-foreground">Confirming driver availability</span>
              </div>
            </div>

            <Button variant="outline" onClick={handleCancel} className="w-full bg-transparent">
              Cancel Request
            </Button>

            <p className="mt-4 text-xs text-muted-foreground">This usually takes less than a minute</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
