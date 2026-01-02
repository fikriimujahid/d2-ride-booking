import { Search, Filter, Download, UserPlus, MoreVertical, Star, MapPin, DollarSign, Clock } from "lucide-react";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  license: string;
  totalRides: number;
  earnings: number;
  rating: number;
  status: "online" | "offline" | "on-ride";
  location: string;
}

const mockDrivers: Driver[] = [
  { id: "D-2001", name: "John Davis", email: "john.d@email.com", phone: "+1 234-567-8901", vehicle: "Toyota Camry 2022", license: "ABC-1234", totalRides: 1247, earnings: 28450.50, rating: 4.9, status: "on-ride", location: "Downtown" },
  { id: "D-2002", name: "Lisa Rodriguez", email: "lisa.r@email.com", phone: "+1 234-567-8902", vehicle: "Honda Accord 2023", license: "XYZ-5678", totalRides: 892, earnings: 21320.75, rating: 4.8, status: "online", location: "Airport" },
  { id: "D-2003", name: "David Kim", email: "david.k@email.com", phone: "+1 234-567-8903", vehicle: "Hyundai Sonata 2022", license: "DEF-9012", totalRides: 1456, earnings: 32180.20, rating: 4.7, status: "on-ride", location: "Central" },
  { id: "D-2004", name: "Anna Lee", email: "anna.l@email.com", phone: "+1 234-567-8904", vehicle: "Nissan Altima 2021", license: "GHI-3456", totalRides: 634, earnings: 15450.00, rating: 4.6, status: "offline", location: "Suburbs" },
  { id: "D-2005", name: "Mike Johnson", email: "mike.j@email.com", phone: "+1 234-567-8905", vehicle: "Chevrolet Malibu 2023", license: "JKL-7890", totalRides: 2103, earnings: 45120.90, rating: 5.0, status: "online", location: "Tech Park" },
];

export function DriversModule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Total Drivers</p>
          <p className="text-3xl font-semibold text-gray-900">3,847</p>
          <p className="text-sm text-green-600 mt-2">+56 this week</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Online Now</p>
          <p className="text-3xl font-semibold text-gray-900">1,234</p>
          <p className="text-sm text-gray-600 mt-2">32.1% of total</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">On Active Rides</p>
          <p className="text-3xl font-semibold text-gray-900">847</p>
          <p className="text-sm text-blue-600 mt-2">Real-time</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Avg. Earnings</p>
          <p className="text-3xl font-semibold text-gray-900">$24.5K</p>
          <p className="text-sm text-green-600 mt-2">+8.3% vs last month</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Driver Management</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search drivers..."
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
                Add Driver
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Vehicle</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">License</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Total Rides</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Earnings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mockDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {driver.name.split(" ").map(n => n[0]).join("")}
                          </span>
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          driver.status === "online" ? "bg-green-500" :
                          driver.status === "on-ride" ? "bg-blue-500" :
                          "bg-gray-400"
                        }`}></div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{driver.name}</p>
                        <p className="text-sm text-gray-500">{driver.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{driver.vehicle}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{driver.license}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{driver.totalRides.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{driver.earnings.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium text-gray-900">{driver.rating.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      driver.status === "online" ? "bg-green-100 text-green-800" :
                      driver.status === "on-ride" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {driver.status === "online" && "Available"}
                      {driver.status === "on-ride" && "On Ride"}
                      {driver.status === "offline" && "Offline"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">{driver.location}</span>
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
          <span className="text-sm text-gray-600">Showing 5 of 3,847 drivers</span>
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
