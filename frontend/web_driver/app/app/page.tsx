"use client"

import { useState } from "react"
import { StatCard } from "@/components/stat-card"
import { mockDriver, mockTodayStats } from "@/lib/mock-data"
import { ToggleLeft, ToggleRight, MapPin, Clock, DollarSign, Zap } from "lucide-react"

export default function DashboardPage() {
  const [isOnline, setIsOnline] = useState(false)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">Welcome, {mockDriver.name.split(" ")[0]}</h1>
        <p className="text-secondary mt-2">Manage your driving and earnings</p>
      </div>

      {/* Status Toggle */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Driver Status</h2>
            <p className="text-secondary text-sm mt-1">
              {isOnline ? "You are currently online and accepting rides" : "You are offline"}
            </p>
          </div>
          <button
            onClick={() => setIsOnline(!isOnline)}
            className="flex items-center gap-2 px-6 py-3 rounded-lg transition-colors"
            style={{
              backgroundColor: isOnline ? "rgb(34, 197, 94)" : "rgb(107, 114, 128)",
              color: "white",
            }}
          >
            {isOnline ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            <span className="font-semibold">{isOnline ? "Online" : "Offline"}</span>
          </button>
        </div>
      </div>

      {/* Today's Stats */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">Today's Summary</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <StatCard label="Trips Completed" value={mockTodayStats.tripsCompleted} icon={<Zap />} />
          <StatCard label="Earnings" value={`$${mockTodayStats.earnings.toFixed(2)}`} icon={<DollarSign />} />
          <StatCard
            label="Distance"
            value={`${mockTodayStats.distance} mi`}
            subtext="Total distance driven"
            icon={<MapPin />}
          />
          <StatCard label="Hours" value={mockTodayStats.hours} subtext="Time on platform" icon={<Clock />} />
        </div>
      </div>

      {/* Driver Info Panel */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Driver Profile</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Rating</span>
              <span className="text-foreground font-semibold">{mockDriver.rating} ★</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Total Trips</span>
              <span className="text-foreground font-semibold">{mockDriver.totalTrips}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Member Since</span>
              <span className="text-foreground font-semibold">
                {new Date(mockDriver.joinDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Vehicle Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">Vehicle</span>
              <span className="text-foreground font-semibold">
                {mockDriver.vehicle.year} {mockDriver.vehicle.make} {mockDriver.vehicle.model}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">License Plate</span>
              <span className="text-foreground font-semibold">{mockDriver.vehicle.licensePlate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">Color</span>
              <span className="text-foreground font-semibold">{mockDriver.vehicle.color}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
