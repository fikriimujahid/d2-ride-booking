import { useState } from "react";
import { Shield, Bell, Users, Database, Globe } from "lucide-react";

export function SettingsModule() {
  // 2FA is enforced for admin access and managed via the dedicated enrollment flow at sign-in.

  return (
    <div className="space-y-6">
      {/* Security Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Security & Authentication</h3>
              <p className="text-sm text-gray-500">Manage authentication and security settings</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Two-Factor Authentication (2FA)</p>
              <p className="text-sm text-gray-500 mt-1">Required for admin access and managed at sign-in</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium"
              >
                Enabled
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Biometric Authentication</p>
              <p className="text-sm text-gray-500 mt-1">Use fingerprint or face recognition for login</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Session Timeout</p>
              <p className="text-sm text-gray-500 mt-1">Automatically log out after inactivity</p>
            </div>
            <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>15 minutes</option>
              <option>30 minutes</option>
              <option>1 hour</option>
              <option>4 hours</option>
            </select>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Login Notifications</p>
              <p className="text-sm text-gray-500 mt-1">Get notified of new login attempts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Bell className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Notification Preferences</h3>
              <p className="text-sm text-gray-500">Configure how you receive alerts and updates</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Fraud Alerts</p>
              <p className="text-sm text-gray-500 mt-1">Immediate notifications for fraud detection</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Dispute Notifications</p>
              <p className="text-sm text-gray-500 mt-1">Alert when new disputes are filed</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">System Status Updates</p>
              <p className="text-sm text-gray-500 mt-1">Platform performance and outage alerts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked className="sr-only peer" readOnly />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Daily Reports</p>
              <p className="text-sm text-gray-500 mt-1">Receive daily analytics summary via email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Role Management */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Role-Based Access Control</h3>
              <p className="text-sm text-gray-500">Manage admin roles and permissions</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Super Admin</h4>
                  <p className="text-sm text-gray-500 mt-1">Full system access and control</p>
                </div>
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">2 users</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">All Permissions</span>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Operations Manager</h4>
                  <p className="text-sm text-gray-500 mt-1">Manage rides, drivers, and passengers</p>
                </div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">5 users</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">View Dashboard</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Manage Rides</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Manage Users</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Handle Disputes</span>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Support Agent</h4>
                  <p className="text-sm text-gray-500 mt-1">Handle customer support and disputes</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">12 users</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">View Dashboard</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">View Users</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Handle Disputes</span>
              </div>
            </div>

            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Analyst</h4>
                  <p className="text-sm text-gray-500 mt-1">View analytics and generate reports</p>
                </div>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">3 users</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">View Dashboard</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">View Analytics</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">Export Reports</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Configuration */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Database className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Data & Privacy</h3>
                <p className="text-sm text-gray-500">Manage data retention and privacy</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Data Retention Period</span>
              <span className="text-sm font-medium text-gray-900">90 days</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Backup Frequency</span>
              <span className="text-sm font-medium text-gray-900">Daily</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">GDPR Compliance</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Enabled</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Globe className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Regional Settings</h3>
                <p className="text-sm text-gray-500">Configure regional preferences</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Primary Region</span>
              <span className="text-sm font-medium text-gray-900">North America</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Currency</span>
              <span className="text-sm font-medium text-gray-900">USD ($)</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-700">Time Zone</span>
              <span className="text-sm font-medium text-gray-900">EST (UTC-5)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
