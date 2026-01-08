import { useState } from 'react';
import { DollarSign, TrendingUp, Percent, Plus, Edit } from 'lucide-react';

interface Promotion {
  id: string;
  name: string;
  code: string;
  discount: number;
  type: 'percentage' | 'fixed';
  status: 'active' | 'scheduled' | 'expired';
  usageCount: number;
  maxUsage: number;
  validUntil: string;
}

export default function PricingManagement() {
  const [surgePricing, setSurgePricing] = useState(1.5);

  const promotions: Promotion[] = [
    {
      id: 'PR001',
      name: 'New Year Special',
      code: 'NEWYEAR25',
      discount: 25,
      type: 'percentage',
      status: 'active',
      usageCount: 1243,
      maxUsage: 5000,
      validUntil: '2025-01-31'
    },
    {
      id: 'PR002',
      name: 'First Ride Free',
      code: 'FIRST15',
      discount: 15,
      type: 'fixed',
      status: 'active',
      usageCount: 892,
      maxUsage: 2000,
      validUntil: '2025-12-31'
    },
    {
      id: 'PR003',
      name: 'Weekend Rider',
      code: 'WEEKEND10',
      discount: 10,
      type: 'percentage',
      status: 'scheduled',
      usageCount: 0,
      maxUsage: 3000,
      validUntil: '2025-02-28'
    },
    {
      id: 'PR004',
      name: 'Holiday Season',
      code: 'HOLIDAY20',
      discount: 20,
      type: 'percentage',
      status: 'expired',
      usageCount: 4567,
      maxUsage: 5000,
      validUntil: '2024-12-25'
    },
  ];

  const pricingTiers = [
    { name: 'Base Fare', price: 2.50, unit: 'per ride' },
    { name: 'Per Mile', price: 1.75, unit: 'per mile' },
    { name: 'Per Minute', price: 0.35, unit: 'per minute' },
    { name: 'Minimum Fare', price: 6.00, unit: 'minimum' },
    { name: 'Cancellation Fee', price: 5.00, unit: 'per cancellation' },
    { name: 'Airport Surcharge', price: 3.50, unit: 'per trip' },
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      scheduled: 'bg-blue-100 text-blue-700',
      expired: 'bg-slate-100 text-slate-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Pricing Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Surge Pricing */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2>Surge Pricing</h2>
            <TrendingUp className="w-5 h-5 text-orange-600" />
          </div>
          <div className="mb-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl">{surgePricing}x</span>
              <span className="text-slate-600">multiplier</span>
            </div>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.1"
            value={surgePricing}
            onChange={(e) => setSurgePricing(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-2">
            <span>Normal (1.0x)</span>
            <span>High (3.0x)</span>
          </div>
          <p className="text-sm text-slate-600 mt-4">
            Current surge is affecting Downtown and Airport zones
          </p>
        </div>

        {/* Revenue Stats */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2>Revenue Impact</h2>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-600">Base Revenue</p>
              <p className="text-2xl">$24,567</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Surge Revenue</p>
              <p className="text-2xl text-orange-600">+$8,234</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Promo Discounts</p>
              <p className="text-2xl text-red-600">-$3,450</p>
            </div>
          </div>
        </div>

        {/* Promo Usage */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2>Promo Usage</h2>
            <Percent className="w-5 h-5 text-purple-600" />
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Active Promos</span>
                <span>{promotions.filter(p => p.status === 'active').length}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Total Uses Today</span>
                <span>2,135</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span>Discount Rate</span>
                <span>14.2%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Tiers */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2>Pricing Configuration</h2>
              <p className="text-slate-600">Base pricing structure</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Edit className="w-4 h-4" />
              Edit Pricing
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {pricingTiers.map((tier) => (
            <div key={tier.name} className="p-4 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-600 mb-2">{tier.name}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl">${tier.price}</span>
                <span className="text-sm text-slate-500">{tier.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promotions */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2>Promotions & Discounts</h2>
              <p className="text-slate-600">Manage promotional campaigns</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Plus className="w-4 h-4" />
              Create Promotion
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-slate-600">ID</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Name</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Code</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Discount</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Usage</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Valid Until</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Status</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{promo.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{promo.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm px-3 py-1 bg-slate-100 rounded font-mono">{promo.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">
                      {promo.type === 'percentage' ? `${promo.discount}%` : `$${promo.discount}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm">{promo.usageCount} / {promo.maxUsage}</p>
                      <div className="w-24 bg-slate-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${(promo.usageCount / promo.maxUsage) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{promo.validUntil}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadge(promo.status)}`}>
                      {promo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-sm text-blue-600 hover:text-blue-700">
                      Edit
                    </button>
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
