import { Car, Users, DollarSign, TrendingUp, Activity, MapPin } from "lucide-react";
import { StatCard } from "./StatCard";
import { LiveMap } from "./LiveMap";
import { RecentRidesTable } from "./RecentRidesTable";

export function LiveDashboard() {
  return (
    <div className="space-y-6">
      {/* Real-time Stats */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          label="Active Rides"
          value="847"
          change="+23 in last hour"
          changeType="positive"
          icon={Car}
          iconColor="bg-blue-100 text-blue-600"
        />
        <StatCard
          label="Online Drivers"
          value="1,234"
          change="85% availability"
          changeType="positive"
          icon={Users}
          iconColor="bg-green-100 text-green-600"
        />
        <StatCard
          label="Revenue Today"
          value="$47.2K"
          change="+12.5% vs yesterday"
          changeType="positive"
          icon={DollarSign}
          iconColor="bg-purple-100 text-purple-600"
        />
        <StatCard
          label="Avg. Wait Time"
          value="3.2 min"
          change="-0.8 min improvement"
          changeType="positive"
          icon={Activity}
          iconColor="bg-orange-100 text-orange-600"
        />
      </div>

      {/* Live Map */}
      <LiveMap />

      {/* Quick Stats Row */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-600">Peak Hours Today</h4>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Morning Rush (7-9 AM)</span>
              <span className="text-sm font-medium text-gray-900">2,341 rides</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Evening Rush (5-7 PM)</span>
              <span className="text-sm font-medium text-gray-900">2,847 rides</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Current Hour</span>
              <span className="text-sm font-medium text-blue-600">1,523 rides</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-600">Top Locations</h4>
            <MapPin className="w-4 h-4 text-green-600" />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Downtown Plaza</span>
              <span className="text-sm font-medium text-gray-900">342 pickups</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Airport Terminal</span>
              <span className="text-sm font-medium text-gray-900">298 pickups</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Tech Park</span>
              <span className="text-sm font-medium text-gray-900">234 pickups</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-600">System Status</h4>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 font-medium">All Systems Operational</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">API Response Time</span>
              <span className="text-sm font-medium text-green-600">127ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">GPS Accuracy</span>
              <span className="text-sm font-medium text-green-600">98.4%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900">Payment Success</span>
              <span className="text-sm font-medium text-green-600">99.7%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Rides */}
      <RecentRidesTable />
    </div>
  );
}
