import { Shield, AlertTriangle, CheckCircle, XCircle, TrendingDown, Eye, Ban } from "lucide-react";

interface FraudAlert {
  id: string;
  type: "payment-fraud" | "location-spoofing" | "fake-account" | "rating-manipulation" | "suspicious-activity";
  severity: "critical" | "high" | "medium" | "low";
  entity: string;
  entityType: "driver" | "passenger";
  description: string;
  detectedAt: string;
  status: "open" | "investigating" | "resolved" | "false-positive";
  riskScore: number;
}

const mockAlerts: FraudAlert[] = [
  { id: "FRD-7821", type: "payment-fraud", severity: "critical", entity: "P-1234", entityType: "passenger", description: "Multiple failed payment attempts with different cards", detectedAt: "15 min ago", status: "open", riskScore: 95 },
  { id: "FRD-7820", type: "location-spoofing", severity: "high", entity: "D-5678", entityType: "driver", description: "GPS location inconsistent with actual movement patterns", detectedAt: "1 hour ago", status: "investigating", riskScore: 87 },
  { id: "FRD-7819", type: "fake-account", severity: "high", entity: "P-9012", entityType: "passenger", description: "Account created with suspicious email pattern", detectedAt: "2 hours ago", status: "investigating", riskScore: 82 },
  { id: "FRD-7818", type: "rating-manipulation", severity: "medium", entity: "D-3456", entityType: "driver", description: "Unusual spike in 5-star ratings from new accounts", detectedAt: "5 hours ago", status: "resolved", riskScore: 68 },
  { id: "FRD-7817", type: "suspicious-activity", severity: "medium", entity: "P-7890", entityType: "passenger", description: "Abnormal ride patterns and cancellation rate", detectedAt: "8 hours ago", status: "false-positive", riskScore: 54 },
];

interface AuditLog {
  id: string;
  action: string;
  admin: string;
  target: string;
  timestamp: string;
  details: string;
}

const mockAuditLogs: AuditLog[] = [
  { id: "AUD-1001", action: "Account Suspended", admin: "Admin A", target: "Driver D-1234", timestamp: "10 min ago", details: "Multiple violations detected" },
  { id: "AUD-1002", action: "Payment Refunded", admin: "Admin B", target: "Passenger P-5678", timestamp: "25 min ago", details: "Fraudulent charge reversed - $45.50" },
  { id: "AUD-1003", action: "Dispute Resolved", admin: "Admin C", target: "Ride R-7821", timestamp: "1 hour ago", details: "Resolved in favor of passenger" },
  { id: "AUD-1004", action: "Price Rule Modified", admin: "Admin A", target: "Surge Pricing", timestamp: "2 hours ago", details: "Changed multiplier from 1.8x to 1.5x" },
  { id: "AUD-1005", action: "Driver Verified", admin: "Admin B", target: "Driver D-9012", timestamp: "3 hours ago", details: "Background check completed" },
];

export function FraudModule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Active Alerts</p>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">12</p>
          <p className="text-sm text-red-600 mt-2">3 critical</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Fraud Blocked</p>
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">$47.2K</p>
          <p className="text-sm text-green-600 mt-2">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Fraud Rate</p>
            <TrendingDown className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">0.14%</p>
          <p className="text-sm text-green-600 mt-2">-0.03% vs last month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">Avg. Detection Time</p>
            <Shield className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-3xl font-semibold text-gray-900">8.5m</p>
          <p className="text-sm text-green-600 mt-2">-2.1m improvement</p>
        </div>
      </div>

      {/* Fraud Alerts */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Fraud Detection Alerts</h3>
              <p className="text-sm text-gray-500 mt-1">Real-time fraud monitoring and detection</p>
            </div>
            <div className="flex items-center gap-2">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Severities</option>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Statuses</option>
                <option>Open</option>
                <option>Investigating</option>
                <option>Resolved</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {mockAlerts.map((alert) => (
            <div key={alert.id} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-blue-600">{alert.id}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      alert.severity === "critical" ? "bg-red-100 text-red-800" :
                      alert.severity === "high" ? "bg-orange-100 text-orange-800" :
                      alert.severity === "medium" ? "bg-yellow-100 text-yellow-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      alert.status === "open" ? "bg-red-100 text-red-800" :
                      alert.status === "investigating" ? "bg-yellow-100 text-yellow-800" :
                      alert.status === "resolved" ? "bg-green-100 text-green-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {alert.status === "open" && <AlertTriangle className="w-3 h-3" />}
                      {alert.status === "investigating" && <Eye className="w-3 h-3" />}
                      {alert.status === "resolved" && <CheckCircle className="w-3 h-3" />}
                      {alert.status === "false-positive" && <XCircle className="w-3 h-3" />}
                      {alert.status === "open" ? "Open" :
                       alert.status === "investigating" ? "Investigating" :
                       alert.status === "resolved" ? "Resolved" : "False Positive"}
                    </span>
                  </div>

                  <h4 className="font-medium text-gray-900 mb-1">
                    {alert.type.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">{alert.description}</p>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Entity:</span>
                      <span className="text-gray-900 font-medium">
                        {alert.entityType === "driver" ? "Driver" : "Passenger"} {alert.entity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Risk Score:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              alert.riskScore >= 80 ? "bg-red-500" :
                              alert.riskScore >= 60 ? "bg-orange-500" :
                              alert.riskScore >= 40 ? "bg-yellow-500" :
                              "bg-green-500"
                            }`}
                            style={{ width: `${alert.riskScore}%` }}
                          ></div>
                        </div>
                        <span className="font-medium text-gray-900">{alert.riskScore}%</span>
                      </div>
                    </div>
                    <div className="text-gray-500">
                      Detected {alert.detectedAt}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {alert.status === "open" && (
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 whitespace-nowrap">
                      Investigate
                    </button>
                  )}
                  {alert.status === "investigating" && (
                    <>
                      <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 whitespace-nowrap flex items-center gap-2">
                        <Ban className="w-4 h-4" />
                        Suspend Entity
                      </button>
                      <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 whitespace-nowrap">
                        Mark Resolved
                      </button>
                    </>
                  )}
                  <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 whitespace-nowrap flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Recent Audit Logs</h3>
          <p className="text-sm text-gray-500 mt-1">All administrative actions are logged</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Log ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Administrator</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mockAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-600">{log.id}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">{log.action}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{log.admin}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-blue-600">{log.target}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{log.details}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">{log.timestamp}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-600">Showing 5 of 3,847 log entries</span>
          <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All Logs →</button>
        </div>
      </div>
    </div>
  );
}
