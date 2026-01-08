import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Users, Car, Clock } from 'lucide-react';

export default function Analytics() {
  const revenueData = [
    { name: 'Mon', revenue: 4200, rides: 145 },
    { name: 'Tue', revenue: 3800, rides: 132 },
    { name: 'Wed', revenue: 5100, rides: 178 },
    { name: 'Thu', revenue: 4700, rides: 162 },
    { name: 'Fri', revenue: 6200, rides: 215 },
    { name: 'Sat', revenue: 7800, rides: 267 },
    { name: 'Sun', revenue: 6500, rides: 223 },
  ];

  const hourlyData = [
    { hour: '00', rides: 12 },
    { hour: '03', rides: 8 },
    { hour: '06', rides: 45 },
    { hour: '09', rides: 123 },
    { hour: '12', rides: 167 },
    { hour: '15', rides: 145 },
    { hour: '18', rides: 189 },
    { hour: '21', rides: 134 },
  ];

  const vehicleTypeData = [
    { name: 'Sedan', value: 450, color: '#3b82f6' },
    { name: 'SUV', value: 280, color: '#8b5cf6' },
    { name: 'Premium', value: 180, color: '#ec4899' },
    { name: 'Compact', value: 90, color: '#10b981' },
  ];

  const kpis = [
    {
      label: 'Total Revenue',
      value: '$38,300',
      change: '+12.5%',
      trend: 'up',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Total Rides',
      value: '1,322',
      change: '+8.2%',
      trend: 'up',
      icon: Car,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Active Users',
      value: '8,945',
      change: '+15.3%',
      trend: 'up',
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      label: 'Avg Wait Time',
      value: '4.2 min',
      change: '-2.1%',
      trend: 'down',
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;
          return (
            <div key={kpi.label} className="bg-white p-6 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${kpi.bgColor} rounded-lg`}>
                  <Icon className={`w-6 h-6 ${kpi.color}`} />
                </div>
                <div className={`flex items-center gap-1 text-sm ${
                  kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  <TrendIcon className="w-4 h-4" />
                  {kpi.change}
                </div>
              </div>
              <h3 className="text-2xl mb-1">{kpi.value}</h3>
              <p className="text-slate-600">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="mb-6">
            <h2>Revenue Trend</h2>
            <p className="text-slate-600">Weekly revenue and ride count</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Revenue ($)"
              />
              <Line 
                type="monotone" 
                dataKey="rides" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                name="Rides"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="mb-6">
            <h2>Hourly Ride Distribution</h2>
            <p className="text-slate-600">Rides by hour of day</p>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="rides" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Type Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="mb-6">
            <h2>Vehicle Types</h2>
            <p className="text-slate-600">Distribution by vehicle category</p>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={vehicleTypeData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {vehicleTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top Metrics */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200">
          <div className="mb-6">
            <h2>Key Performance Metrics</h2>
            <p className="text-slate-600">Current period performance</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Avg Ride Value', value: '$28.95', change: '+5.2%', up: true },
              { label: 'Completion Rate', value: '96.8%', change: '+1.4%', up: true },
              { label: 'Cancellation Rate', value: '3.2%', change: '-0.8%', up: false },
              { label: 'Driver Utilization', value: '78.5%', change: '+3.1%', up: true },
              { label: 'Peak Hour Revenue', value: '$12,450', change: '+8.7%', up: true },
              { label: 'Avg Rating', value: '4.7', change: '+0.1', up: true },
            ].map((metric) => (
              <div key={metric.label} className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-600 mb-1">{metric.label}</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl">{metric.value}</span>
                  <span className={`text-sm ${
                    metric.up ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2>Top Performing Drivers</h2>
          <p className="text-slate-600">Drivers with highest ratings and completion rates</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rank</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Driver</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rides</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Revenue</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rating</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Completion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {[
                { rank: 1, name: 'Lisa Brown', rides: 203, revenue: 5670, rating: 5.0, completion: 99.1 },
                { rank: 2, name: 'John Smith', rides: 187, revenue: 5340, rating: 4.9, completion: 98.5 },
                { rank: 3, name: 'Anna Martinez', rides: 164, revenue: 4890, rating: 4.8, completion: 97.8 },
                { rank: 4, name: 'Mike Davis', rides: 156, revenue: 4560, rating: 4.7, completion: 96.2 },
                { rank: 5, name: 'David Lee', rides: 142, revenue: 4120, rating: 4.6, completion: 95.8 },
              ].map((driver) => (
                <tr key={driver.rank} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full">
                      {driver.rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{driver.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{driver.rides}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">${driver.revenue.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{driver.rating}</span>
                      <span className="text-yellow-500">★</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{driver.completion}%</span>
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
