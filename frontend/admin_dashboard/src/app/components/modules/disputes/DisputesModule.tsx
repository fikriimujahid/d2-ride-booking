import { AlertCircle, Clock, CheckCircle, XCircle, MessageSquare, User, Car } from "lucide-react";

interface Dispute {
  id: string;
  rideId: string;
  passenger: string;
  driver: string;
  category: string;
  description: string;
  amount: number;
  status: "open" | "in-review" | "resolved" | "rejected";
  priority: "high" | "medium" | "low";
  createdAt: string;
  assignedTo?: string;
}

const mockDisputes: Dispute[] = [
  { id: "DIS-4521", rideId: "R-7821", passenger: "Sarah Mitchell", driver: "John Davis", category: "Overcharge", description: "Charged more than estimated fare", amount: 45.50, status: "open", priority: "high", createdAt: "2 hours ago" },
  { id: "DIS-4520", rideId: "R-7815", passenger: "Michael Chen", driver: "Lisa Rodriguez", category: "Route Issue", description: "Driver took longer route unnecessarily", amount: 28.75, status: "in-review", priority: "medium", createdAt: "5 hours ago", assignedTo: "Admin A" },
  { id: "DIS-4519", rideId: "R-7808", passenger: "Emma Wilson", driver: "David Kim", category: "Service Quality", description: "Vehicle was not clean", amount: 15.20, status: "resolved", priority: "low", createdAt: "1 day ago", assignedTo: "Admin B" },
  { id: "DIS-4518", rideId: "R-7801", passenger: "James Brown", driver: "Anna Lee", category: "Cancellation Fee", description: "Dispute over cancellation charge", amount: 5.00, status: "rejected", priority: "low", createdAt: "2 days ago", assignedTo: "Admin A" },
  { id: "DIS-4517", rideId: "R-7795", passenger: "Olivia Taylor", driver: "Mike Johnson", category: "Driver Behavior", description: "Driver was rude and unprofessional", amount: 22.90, status: "in-review", priority: "high", createdAt: "2 days ago", assignedTo: "Admin C" },
];

export function DisputesModule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Open Disputes</p>
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">47</p>
          <p className="text-sm text-red-600 mt-2">Requires attention</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">In Review</p>
            <Clock className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">23</p>
          <p className="text-sm text-gray-600 mt-2">Being processed</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Resolved Today</p>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">38</p>
          <p className="text-sm text-green-600 mt-2">+12 vs yesterday</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Avg. Resolution Time</p>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">4.2h</p>
          <p className="text-sm text-green-600 mt-2">-0.8h improvement</p>
        </div>
      </div>

      {/* Disputes List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Dispute Resolution Queue</h3>
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Statuses</option>
                <option>Open</option>
                <option>In Review</option>
                <option>Resolved</option>
                <option>Rejected</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Priorities</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {mockDisputes.map((dispute) => (
            <div key={dispute.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-blue-600">{dispute.id}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dispute.priority === "high" ? "bg-red-100 text-red-800" :
                      dispute.priority === "medium" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {dispute.priority.toUpperCase()} Priority
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      dispute.status === "open" ? "bg-red-100 text-red-800" :
                      dispute.status === "in-review" ? "bg-yellow-100 text-yellow-800" :
                      dispute.status === "resolved" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {dispute.status === "open" && <AlertCircle className="w-3 h-3" />}
                      {dispute.status === "in-review" && <Clock className="w-3 h-3" />}
                      {dispute.status === "resolved" && <CheckCircle className="w-3 h-3" />}
                      {dispute.status === "rejected" && <XCircle className="w-3 h-3" />}
                      {dispute.status === "open" ? "Open" :
                       dispute.status === "in-review" ? "In Review" :
                       dispute.status === "resolved" ? "Resolved" : "Rejected"}
                    </span>
                  </div>

                  <h4 className="font-medium text-gray-900 mb-1">{dispute.category}</h4>
                  <p className="text-sm text-gray-600 mb-3">{dispute.description}</p>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Passenger:</span>
                      <span className="text-gray-900 font-medium">{dispute.passenger}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">Driver:</span>
                      <span className="text-gray-900 font-medium">{dispute.driver}</span>
                    </div>
                    <div className="text-gray-600">
                      Ride: <span className="text-blue-600 font-medium">{dispute.rideId}</span>
                    </div>
                    <div className="text-gray-600">
                      Amount: <span className="text-gray-900 font-medium">${dispute.amount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span>Created {dispute.createdAt}</span>
                    {dispute.assignedTo && (
                      <span className="text-blue-600">Assigned to {dispute.assignedTo}</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {dispute.status === "open" && (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
                      Review Now
                    </button>
                  )}
                  {dispute.status === "in-review" && (
                    <>
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
                        Resolve
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
                        Reject
                      </button>
                    </>
                  )}
                  <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap">
                    <MessageSquare className="w-4 h-4" />
                    Messages
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing 5 of 70 disputes</span>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All Disputes →</button>
        </div>
      </div>
    </div>
  );
}
