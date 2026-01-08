"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MapPin, Clock, Users } from "lucide-react"
import { rideOptions, calculatePrice } from "@/lib/mock-data"

export default function BookRidePage() {
  const router = useRouter()
  const [pickup, setPickup] = useState("")
  const [destination, setDestination] = useState("")
  const [selectedRide, setSelectedRide] = useState("economy")

  // Mock distance calculation
  const estimatedDistance = pickup && destination ? 8.5 : 0
  const estimatedPrice = calculatePrice(estimatedDistance, selectedRide)

  const handleBookRide = () => {
    if (pickup && destination) {
      router.push("/app/matching")
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* Map Section */}
      <div className="h-[300px] w-full bg-muted lg:h-auto lg:flex-1">
        <div className="flex h-full items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MapPin className="mx-auto mb-2 h-12 w-12" />
            <p>Map View</p>
            <p className="text-sm">Interactive map will display here</p>
          </div>
        </div>
      </div>

      {/* Booking Panel */}
      <div className="w-full overflow-y-auto lg:w-[480px] lg:border-l">
        <div className="p-6">
          <h1 className="mb-6 text-2xl font-bold">Book a ride</h1>

          {/* Location Inputs */}
          <div className="mb-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pickup">Pickup Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                  id="pickup"
                  placeholder="Enter pickup address"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destination</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-5 w-5 text-accent" />
                <Input
                  id="destination"
                  placeholder="Where are you going?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          {/* Ride Options */}
          <div className="mb-6">
            <h2 className="mb-4 text-lg font-semibold">Choose your ride</h2>
            <div className="space-y-3">
              {rideOptions.map((option) => {
                const price = calculatePrice(estimatedDistance, option.id)
                return (
                  <Card
                    key={option.id}
                    className={`cursor-pointer transition-all hover:border-accent ${
                      selectedRide === option.id ? "border-accent bg-accent/5" : ""
                    }`}
                    onClick={() => setSelectedRide(option.id)}
                  >
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{option.icon}</div>
                        <div>
                          <h3 className="font-semibold">{option.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {option.estimatedTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {option.capacity}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${pickup && destination ? price.toFixed(2) : "—"}</div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Price Summary */}
          {pickup && destination && (
            <Card className="mb-6 bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated price</p>
                    <p className="text-xs text-muted-foreground">~{estimatedDistance} miles</p>
                  </div>
                  <div className="text-2xl font-bold">${estimatedPrice.toFixed(2)}</div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Book Button */}
          <Button onClick={handleBookRide} disabled={!pickup || !destination} className="w-full" size="lg">
            Request {rideOptions.find((r) => r.id === selectedRide)?.name || "Ride"}
          </Button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By booking, you agree to our terms and conditions
          </p>
        </div>
      </div>
    </div>
  )
}
