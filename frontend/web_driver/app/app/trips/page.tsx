"use client"

import { mockTrips } from "@/lib/mock-data"
import { MapPin, Star } from "lucide-react"
import { useState } from "react"

export default function TripsPage() {
  const [sortBy, setSortBy] = useState<"date" | "earnings">("date")

  const sortedTrips = [...mockTrips].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    } else {
      return b.earnings - a.earnings
    }
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">Trips</h1>
        <p className="text-secondary mt-2">View your trip history and details</p>
      </div>

      {/* Sort Options */}
      <div className="flex gap-3">
        <button
          onClick={() => setSortBy("date")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            sortBy === "date"
              ? "bg-primary text-white"
              : "bg-card border border-border text-secondary hover:text-foreground"
          }`}
        >
          Sort by Date
        </button>
        <button
          onClick={() => setSortBy("earnings")}
          className={`px-4 py-2 rounded-lg transition-colors ${
            sortBy === "earnings"
              ? "bg-primary text-white"
              : "bg-card border border-border text-secondary hover:text-foreground"
          }`}
        >
          Sort by Earnings
        </button>
      </div>

      {/* Trips Table */}
      <div className="space-y-3">
        {sortedTrips.map((trip) => (
          <div
            key={trip.id}
            className="bg-card border border-border rounded-lg p-4 sm:p-6 hover:border-primary transition-colors"
          >
            <div className="grid md:grid-cols-5 gap-4 items-start">
              {/* Trip Route */}
              <div className="md:col-span-2">
                <p className="text-xs text-secondary uppercase tracking-wide mb-1">Route</p>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{trip.pickup}</p>
                      <p className="text-xs text-secondary">Pickup</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{trip.dropoff}</p>
                      <p className="text-xs text-secondary">Dropoff</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Stats */}
              <div className="grid grid-cols-3 gap-3 md:col-span-2">
                <div>
                  <p className="text-xs text-secondary uppercase tracking-wide mb-1">Distance</p>
                  <p className="text-lg font-bold text-foreground">{trip.distance} mi</p>
                </div>
                <div>
                  <p className="text-xs text-secondary uppercase tracking-wide mb-1">Duration</p>
                  <p className="text-lg font-bold text-foreground">{trip.duration} min</p>
                </div>
                <div>
                  <p className="text-xs text-secondary uppercase tracking-wide mb-1">Earnings</p>
                  <p className="text-lg font-bold text-primary">${trip.earnings.toFixed(2)}</p>
                </div>
              </div>

              {/* Trip Details */}
              <div className="flex items-end gap-4 col-span-full md:col-span-5">
                <div className="flex-1">
                  <p className="text-xs text-secondary">
                    {new Date(trip.date).toLocaleDateString()} at {trip.time}
                  </p>
                </div>
                <div className="flex gap-2 items-center">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-foreground">{trip.rating}.0</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Trip Summary</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div>
            <p className="text-secondary text-sm mb-1">Total Trips</p>
            <p className="text-2xl font-bold text-foreground">{mockTrips.length}</p>
          </div>
          <div>
            <p className="text-secondary text-sm mb-1">Total Distance</p>
            <p className="text-2xl font-bold text-foreground">
              {mockTrips.reduce((sum, trip) => sum + trip.distance, 0).toFixed(1)} mi
            </p>
          </div>
          <div>
            <p className="text-secondary text-sm mb-1">Total Duration</p>
            <p className="text-2xl font-bold text-foreground">
              {Math.round(mockTrips.reduce((sum, trip) => sum + trip.duration, 0) / 60)} hrs
            </p>
          </div>
          <div>
            <p className="text-secondary text-sm mb-1">Average Rating</p>
            <p className="text-2xl font-bold text-yellow-500">
              {(mockTrips.reduce((sum, trip) => sum + trip.rating, 0) / mockTrips.length).toFixed(1)} ★
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
