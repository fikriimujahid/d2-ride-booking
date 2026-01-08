"use client"

import { mockWeeklyEarnings, mockMonthlyStats, mockTodayStats } from "@/lib/mock-data"
import { StatCard } from "@/components/stat-card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { DollarSign, TrendingUp, Calendar } from "lucide-react"

export default function EarningsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">Earnings</h1>
        <p className="text-secondary mt-2">Track your income and earnings performance</p>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Today's Earnings" value={`$${mockTodayStats.earnings.toFixed(2)}`} icon={<DollarSign />} />
        <StatCard
          label="This Month"
          value={`$${mockMonthlyStats.totalEarnings.toFixed(2)}`}
          subtext="31 days"
          icon={<Calendar />}
        />
        <StatCard
          label="Average per Trip"
          value={`$${(mockMonthlyStats.totalEarnings / mockMonthlyStats.totalTrips).toFixed(2)}`}
          subtext={`${mockMonthlyStats.totalTrips} trips`}
          icon={<TrendingUp />}
        />
      </div>

      {/* Weekly Chart */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Weekly Earnings</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={mockWeeklyEarnings}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="day" stroke="var(--color-secondary)" />
            <YAxis stroke="var(--color-secondary)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
            />
            <Bar dataKey="earnings" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Breakdown */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Monthly Breakdown</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-secondary">Total Earnings</span>
              <span className="text-2xl font-bold text-primary">${mockMonthlyStats.totalEarnings.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-secondary">Total Trips</span>
              <span className="text-2xl font-bold text-foreground">{mockMonthlyStats.totalTrips}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <span className="text-secondary">Total Distance</span>
              <span className="text-2xl font-bold text-foreground">{mockMonthlyStats.totalDistance} mi</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-secondary">Total Hours</span>
              <span className="text-2xl font-bold text-foreground">{mockMonthlyStats.totalHours}</span>
            </div>
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 flex flex-col justify-center items-center text-center">
            <p className="text-secondary text-sm mb-2">Average Hourly Rate</p>
            <p className="text-4xl font-bold text-primary">
              ${(mockMonthlyStats.totalEarnings / mockMonthlyStats.totalHours).toFixed(2)}/hr
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
