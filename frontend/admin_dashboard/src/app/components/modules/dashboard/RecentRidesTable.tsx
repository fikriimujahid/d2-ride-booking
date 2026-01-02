import { Clock, MapPin, DollarSign, MoreVertical } from "lucide-react";

interface Ride {
  id: string;
  passenger: string;
  driver: string;
  pickup: string;
  dropoff: string;
  amount: number;
  status: "completed" | "active" | "cancelled";
  time: string;
}

const mockRides: Ride[] = [
  { id: "R-7821", passenger: "Sarah Mitchell", driver: "John Davis", pickup: "Downtown Plaza", dropoff: "Airport Terminal 2", amount: 45.50, status: "active", time: "2 min ago" },
  { id: "R-7820", passenger: "Michael Chen", driver: "Lisa Rodriguez", pickup: "Central Station", dropoff: "Tech Park", amount: 28.75, status: "completed", time: "5 min ago" },
  { id: "R-7819", passenger: "Emma Wilson", driver: "David Kim", pickup: "Shopping Mall", dropoff: "Residential Area", amount: 15.20, status: "completed", time: "8 min ago" },
  { id: "R-7818", passenger: "James Brown", driver: "Anna Lee", pickup: "Hotel Riverside", dropoff: "Convention Center", amount: 22.00, status: "cancelled", time: "12 min ago" },
  { id: "R-7817", passenger: "Olivia Taylor", driver: "Mike Johnson", pickup: "University Campus", dropoff: "City Center", amount: 18.90, status: "completed", time: "15 min ago" },
];

export function RecentRidesTable() {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Recent Rides</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Ride ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Passenger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Driver</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Route</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {mockRides.map((ride) => (
              <tr key={ride.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium text-blue-600">{ride.id}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{ride.passenger}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-900">{ride.driver}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-start gap-2 max-w-xs">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-900">
                      <div className="truncate">{ride.pickup}</div>
                      <div className="text-gray-500 truncate">→ {ride.dropoff}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">{ride.amount.toFixed(2)}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    ride.status === "completed" ? "bg-green-100 text-green-800" :
                    ride.status === "active" ? "bg-blue-100 text-blue-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {ride.status === "completed" ? "Completed" :
                     ride.status === "active" ? "Active" :
                     "Cancelled"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    {ride.time}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button className="text-gray-400 hover:text-gray-600">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <span className="text-sm text-gray-600">Showing 5 of 1,247 rides</span>
        <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All Rides →</button>
      </div>
    </div>
  );
}
