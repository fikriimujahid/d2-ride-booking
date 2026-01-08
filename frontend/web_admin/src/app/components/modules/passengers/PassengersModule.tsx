import { Search, Filter, Download, UserPlus, MoreVertical, Star, Ban, CheckCircle } from "lucide-react";

interface Passenger {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalRides: number;
  totalSpent: number;
  rating: number;
  status: "active" | "suspended" | "verified";
  joinDate: string;
}

const mockPassengers: Passenger[] = [
  { id: "P-1001", name: "Sarah Mitchell", email: "sarah.m@email.com", phone: "+1 234-567-8901", totalRides: 142, totalSpent: 2450.50, rating: 4.8, status: "verified", joinDate: "Jan 2024" },
  { id: "P-1002", name: "Michael Chen", email: "m.chen@email.com", phone: "+1 234-567-8902", totalRides: 89, totalSpent: 1820.75, rating: 4.9, status: "verified", joinDate: "Feb 2024" },
  { id: "P-1003", name: "Emma Wilson", email: "emma.w@email.com", phone: "+1 234-567-8903", totalRides: 56, totalSpent: 980.20, rating: 4.6, status: "active", joinDate: "Mar 2024" },
  { id: "P-1004", name: "James Brown", email: "j.brown@email.com", phone: "+1 234-567-8904", totalRides: 23, totalSpent: 450.00, rating: 3.2, status: "suspended", joinDate: "Apr 2024" },
  { id: "P-1005", name: "Olivia Taylor", email: "olivia.t@email.com", phone: "+1 234-567-8905", totalRides: 178, totalSpent: 3120.90, rating: 5.0, status: "verified", joinDate: "Dec 2023" },
  { id: "P-1006", name: "Daniel Martinez", email: "d.martinez@email.com", phone: "+1 234-567-8906", totalRides: 67, totalSpent: 1250.30, rating: 4.7, status: "active", joinDate: "Jan 2024" },
  { id: "P-1007", name: "Sophia Anderson", email: "sophia.a@email.com", phone: "+1 234-567-8907", totalRides: 91, totalSpent: 1680.45, rating: 4.8, status: "verified", joinDate: "Feb 2024" },
];

export function PassengersModule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Passengers</p>
          <p className="text-3xl font-semibold text-gray-900">12,458</p>
          <p className="text-sm text-green-600 mt-2">+234 this week</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Active Today</p>
          <p className="text-3xl font-semibold text-gray-900">3,847</p>
          <p className="text-sm text-gray-600 mt-2">30.9% of total</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Avg. Rating</p>
          <p className="text-3xl font-semibold text-gray-900">4.7</p>
          <div className="flex items-center gap-1 mt-2">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm text-gray-600">Excellent</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Suspended</p>
          <p className="text-3xl font-semibold text-gray-900">127</p>
          <p className="text-sm text-red-600 mt-2">+12 this week</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Passenger Management</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search passengers..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Filter className="w-4 h-4" />
                Filter
              </button>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Download className="w-4 h-4" />
                Export
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                <UserPlus className="w-4 h-4" />
                Add Passenger
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Passenger</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Rides</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Spent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mockPassengers.map((passenger) => (
                <tr key={passenger.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {passenger.name.split(" ").map(n => n[0]).join("")}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{passenger.name}</p>
                        <p className="text-sm text-gray-500">{passenger.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{passenger.email}</div>
                    <div className="text-sm text-gray-500">{passenger.phone}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{passenger.totalRides}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">${passenger.totalSpent.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-900">{passenger.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      passenger.status === "verified" ? "bg-green-100 text-green-800" :
                      passenger.status === "active" ? "bg-blue-100 text-blue-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {passenger.status === "verified" && <CheckCircle className="w-3 h-3" />}
                      {passenger.status === "suspended" && <Ban className="w-3 h-3" />}
                      {passenger.status.charAt(0).toUpperCase() + passenger.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{passenger.joinDate}</span>
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
          <span className="text-sm text-gray-600">Showing 7 of 12,458 passengers</span>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">1</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">2</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">3</button>
            <button className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
