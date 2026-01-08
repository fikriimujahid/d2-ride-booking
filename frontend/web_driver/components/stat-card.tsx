import type React from "react"
interface StatCardProps {
  label: string
  value: string | number
  subtext?: string
  icon?: React.ReactNode
}

export function StatCard({ label, value, subtext, icon }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-secondary text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
          {subtext && <p className="text-secondary text-xs mt-2">{subtext}</p>}
        </div>
        {icon && <div className="text-primary text-2xl">{icon}</div>}
      </div>
    </div>
  )
}
