import { DollarSign, Percent, Plus, Edit2, Trash2, Calendar, Tag } from "lucide-react";

interface PriceRule {
  id: string;
  name: string;
  type: "base" | "surge" | "discount";
  description: string;
  value: number;
  unit: "fixed" | "percent" | "multiplier";
  active: boolean;
  conditions?: string;
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  discount: number;
  type: "percent" | "fixed";
  minAmount: number;
  maxDiscount?: number;
  usageLimit: number;
  usageCount: number;
  validFrom: string;
  validTo: string;
  status: "active" | "scheduled" | "expired";
}

const mockPriceRules: PriceRule[] = [
  { id: "PR-001", name: "Base Fare", type: "base", description: "Standard starting fare", value: 3.50, unit: "fixed", active: true },
  { id: "PR-002", name: "Per Mile Rate", type: "base", description: "Cost per mile traveled", value: 1.75, unit: "fixed", active: true },
  { id: "PR-003", name: "Per Minute Rate", type: "base", description: "Cost per minute of ride", value: 0.35, unit: "fixed", active: true },
  { id: "PR-004", name: "Peak Hours Surge", type: "surge", description: "Monday-Friday 7-9 AM, 5-7 PM", value: 1.5, unit: "multiplier", active: true, conditions: "Peak commute hours" },
  { id: "PR-005", name: "Airport Premium", type: "surge", description: "Airport pickup/dropoff fee", value: 5.00, unit: "fixed", active: true, conditions: "Airport zone" },
];

const mockPromotions: Promotion[] = [
  { id: "PROMO-001", code: "WELCOME50", name: "New User Welcome", discount: 50, type: "percent", minAmount: 10, maxDiscount: 25, usageLimit: 1, usageCount: 2847, validFrom: "Jan 1", validTo: "Dec 31", status: "active" },
  { id: "PROMO-002", code: "SUMMER20", name: "Summer Special", discount: 20, type: "percent", minAmount: 15, maxDiscount: 15, usageLimit: 5, usageCount: 1523, validFrom: "Jun 1", validTo: "Aug 31", status: "active" },
  { id: "PROMO-003", code: "FLAT10", name: "Flat $10 Off", discount: 10, type: "fixed", minAmount: 30, usageLimit: 3, usageCount: 892, validFrom: "Jul 15", validTo: "Jul 31", status: "active" },
  { id: "PROMO-004", code: "HOLIDAY25", name: "Holiday Promo", discount: 25, type: "percent", minAmount: 20, maxDiscount: 30, usageLimit: 10, usageCount: 0, validFrom: "Dec 20", validTo: "Jan 5", status: "scheduled" },
];

export function PricingModule() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Avg. Ride Price</p>
          <p className="text-3xl font-semibold text-gray-900">$18.45</p>
          <p className="text-sm text-green-600 mt-2">+$1.20 vs last month</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Active Promotions</p>
          <p className="text-3xl font-semibold text-gray-900">3</p>
          <p className="text-sm text-gray-600 mt-2">1 scheduled</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Promo Redemptions</p>
          <p className="text-3xl font-semibold text-gray-900">5.2K</p>
          <p className="text-sm text-blue-600 mt-2">This month</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-1">Discount Given</p>
          <p className="text-3xl font-semibold text-gray-900">$42.8K</p>
          <p className="text-sm text-red-600 mt-2">Total this month</p>
        </div>
      </div>

      {/* Pricing Rules */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Pricing Rules</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {mockPriceRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-3 rounded-lg ${
                    rule.type === "base" ? "bg-blue-100" :
                    rule.type === "surge" ? "bg-orange-100" :
                    "bg-green-100"
                  }`}>
                    <DollarSign className={`w-5 h-5 ${
                      rule.type === "base" ? "text-blue-600" :
                      rule.type === "surge" ? "text-orange-600" :
                      "text-green-600"
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-medium text-gray-900">{rule.name}</h4>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rule.type === "base" ? "bg-blue-100 text-blue-800" :
                        rule.type === "surge" ? "bg-orange-100 text-orange-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{rule.description}</p>
                    {rule.conditions && (
                      <p className="text-xs text-gray-500 mt-1">Conditions: {rule.conditions}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-gray-900">
                      {rule.unit === "percent" && `${rule.value}%`}
                      {rule.unit === "fixed" && `$${rule.value}`}
                      {rule.unit === "multiplier" && `${rule.value}x`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {rule.unit === "multiplier" ? "Multiplier" : "Per unit"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={rule.active} className="sr-only peer" readOnly />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Promotions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Promotional Campaigns</h3>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Conditions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Valid Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {mockPromotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-semibold text-blue-600">{promo.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{promo.name}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {promo.type === "percent" ? (
                        <>
                          <Percent className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{promo.discount}% off</span>
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">${promo.discount} off</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      <div>Min: ${promo.minAmount}</div>
                      {promo.maxDiscount && <div className="text-xs text-gray-500">Max: ${promo.maxDiscount}</div>}
                      <div className="text-xs text-gray-500">Limit: {promo.usageLimit}x per user</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <span className="font-medium text-gray-900">{promo.usageCount.toLocaleString()}</span>
                      <span className="text-gray-500"> redemptions</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <div>{promo.validFrom} -</div>
                        <div>{promo.validTo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      promo.status === "active" ? "bg-green-100 text-green-800" :
                      promo.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {promo.status.charAt(0).toUpperCase() + promo.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
