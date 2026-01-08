import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: string;
}

export function StatCard({ label, value, change, changeType = "neutral", icon: Icon, iconColor = "bg-blue-100 text-blue-600" }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-3xl font-semibold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm mt-2 ${
              changeType === "positive" ? "text-green-600" : 
              changeType === "negative" ? "text-red-600" : 
              "text-gray-600"
            }`}>
              {change}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
