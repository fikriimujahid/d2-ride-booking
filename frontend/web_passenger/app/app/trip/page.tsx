"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MapPin, Phone, MessageSquare, Star, Navigation } from "lucide-react"
import { mockDriver } from "@/lib/mock-data"

export default function TripPage() {
  const router = useRouter()
  const [eta, setEta] = useState(12)

  useEffect(() => {
    // Simulate ETA countdown
    const interval = setInterval(() => {
      setEta((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Simulate ride completion after 15 seconds
    const timer = setTimeout(() => {
      router.push("/app/history")
    }, 15000)

    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [router])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Map Section */}
      <div className="h-[400px] w-full bg-muted lg:h-auto lg:flex-1">
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Navigation className="mx-auto mb-2 h-12 w-12" />
            <p>Live Tracking</p>
            <p className="text-sm">Your driver is on the way</p>
          </div>
        </div>
      </div>

      {/* Trip Info Panel */}
      <div className="w-full overflow-y-auto lg:w-[420px] lg:border-l">
        <div className="p-6">
          {/* Status Banner */}
          <Card className="mb-6 border-accent bg-accent/10">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="mb-1 text-sm font-medium text-accent">Driver arriving in</p>
                <p className="text-3xl font-bold">{eta} min</p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Info */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="mb-4 flex items-start justify-between">
                <div className="flex gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={mockDriver.photo || "/placeholder.svg"} alt={mockDriver.name} />
                    <AvatarFallback>{mockDriver.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-lg font-semibold">{mockDriver.name}</h2>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{mockDriver.rating}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{mockDriver.carModel}</p>
                    <p className="text-sm font-medium">{mockDriver.licensePlate}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
                <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                  <MessageSquare className="h-4 w-4" />
                  Message
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Trip Details */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="mb-4 font-semibold">Trip Details</h3>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Pickup</p>
                    <p className="text-sm text-muted-foreground">123 Main St, San Francisco, CA</p>
                  </div>
                </div>
                <div className="ml-4 h-4 w-0.5 bg-border" />
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Destination</p>
                    <p className="text-sm text-muted-foreground">456 Market St, San Francisco, CA</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Safety Features */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Safety Toolkit</p>
                  <p className="text-xs text-muted-foreground">Share trip, emergency contacts</p>
                </div>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </div>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Your ride will be completed automatically. Thank you for choosing RideGo!
          </p>
        </div>
      </div>
    </div>
  )
}
