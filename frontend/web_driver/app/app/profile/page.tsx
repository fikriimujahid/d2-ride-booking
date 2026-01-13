"use client"

import { mockDriver } from "@/lib/mock-data"
import { Mail, Phone, Car, CreditCard, Edit2, LogOut } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">Profile</h1>
        <p className="text-secondary mt-2">Manage your account and settings</p>
      </div>

      {/* Profile Card */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary to-primary/80" />

        <div className="px-6 py-8 relative">
          {/* Profile Image */}
          <div className="absolute -top-16 left-6">
            <Image
              src={mockDriver.profileImage || "/placeholder.svg"}
              alt={mockDriver.name}
              width={128}
              height={128}
              className="w-32 h-32 rounded-full border-4 border-card bg-border"
              priority
            />
          </div>

          {/* Profile Info */}
          <div className="pt-20 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-3xl font-bold text-foreground">{mockDriver.name}</h2>
                <p className="text-secondary mt-1">Rating: {mockDriver.rating} ★</p>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>

            {/* Contact Info */}
            <div className="grid md:grid-cols-2 gap-6 pt-6 border-t border-border">
              <div className="flex gap-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="text-secondary text-sm">Email</p>
                  <p className="text-foreground font-medium">{mockDriver.email}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Phone className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="text-secondary text-sm">Phone</p>
                  <p className="text-foreground font-medium">{mockDriver.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          Vehicle Information
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-secondary text-sm mb-1">Vehicle</p>
              <p className="text-lg font-semibold text-foreground">
                {mockDriver.vehicle.year} {mockDriver.vehicle.make} {mockDriver.vehicle.model}
              </p>
            </div>

            <div>
              <p className="text-secondary text-sm mb-1">Color</p>
              <p className="text-lg font-semibold text-foreground">{mockDriver.vehicle.color}</p>
            </div>

            <div>
              <p className="text-secondary text-sm mb-1">Seating Capacity</p>
              <p className="text-lg font-semibold text-foreground">{mockDriver.vehicle.seatingCapacity} passengers</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-secondary text-sm mb-1">License Plate</p>
              <p className="text-lg font-mono font-semibold text-foreground">{mockDriver.vehicle.licensePlate}</p>
            </div>

            <div>
              <p className="text-secondary text-sm mb-1">Year</p>
              <p className="text-lg font-semibold text-foreground">{mockDriver.vehicle.year}</p>
            </div>

            <button className="w-full mt-4 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-border transition-colors">
              Update Vehicle
            </button>
          </div>
        </div>
      </div>

      {/* Payout Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Payout Settings
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-secondary text-sm mb-2">Payment Method</p>
            <div className="flex items-center justify-between p-4 bg-background rounded-lg border border-border">
              <span className="font-medium text-foreground">{mockDriver.payoutMethod}</span>
              <span className="text-primary font-semibold">●●●●●●●●{mockDriver.bankAccount.slice(-4)}</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <button className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-border transition-colors">
              Update Payment Method
            </button>
            <button className="px-4 py-2 border border-border text-foreground rounded-lg hover:bg-border transition-colors">
              View Payout History
            </button>
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold text-foreground mb-6">Account Settings</h2>

        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 rounded-lg border border-border text-foreground hover:bg-border transition-colors">
            Change Password
          </button>
          <button className="w-full text-left px-4 py-3 rounded-lg border border-border text-foreground hover:bg-border transition-colors">
            Two-Factor Authentication
          </button>
          <button className="w-full text-left px-4 py-3 rounded-lg border border-border text-foreground hover:bg-border transition-colors">
            Connected Devices
          </button>
        </div>
      </div>

      {/* Logout Button */}
      <button className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 rounded-lg border border-red-500/30 hover:bg-red-500/20 transition-colors font-semibold">
        <LogOut className="w-5 h-5" />
        Logout
      </button>
    </div>
  )
}
