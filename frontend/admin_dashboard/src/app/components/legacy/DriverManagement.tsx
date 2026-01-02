import { useState } from 'react';
import { Search, Filter, Download, UserPlus, MoreVertical, CheckCircle, XCircle, Clock } from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  totalRides: number;
  earnings: number;
  avgRating: number;
  status: 'online' | 'offline' | 'busy';
  verificationStatus: 'verified' | 'pending' | 'rejected';
  joinDate: string;
  completionRate: number;
}

export default function DriverManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const drivers: Driver[] = [
    {
      id: 'D001',
      name: 'John Smith',
      email: 'john.s@email.com',
      phone: '+1 (555) 111-2222',
      vehicleType: 'Sedan',
      licensePlate: 'ABC-123',
      totalRides: 1547,
      earnings: 45230.50,
      avgRating: 4.9,
      status: 'online',
      verificationStatus: 'verified',
      joinDate: '2022-06-15',
      completionRate: 98.5
    },
    {
      id: 'D002',
      name: 'Mike Davis',
      email: 'mike.d@email.com',
      phone: '+1 (555) 222-3333',
      vehicleType: 'SUV',
      licensePlate: 'XYZ-789',
      totalRides: 892,
      earnings: 28450.00,
      avgRating: 4.7,
      status: 'busy',
      verificationStatus: 'verified',
      joinDate: '2022-09-20',
      completionRate: 96.2
    },
    {
      id: 'D003',
      name: 'Lisa Brown',
      email: 'lisa.b@email.com',
      phone: '+1 (555) 333-4444',
      vehicleType: 'Sedan',
      licensePlate: 'DEF-456',
      totalRides: 2103,
      earnings: 62890.75,
      avgRating: 5.0,
      status: 'online',
      verificationStatus: 'verified',
      joinDate: '2021-11-10',
      completionRate: 99.1
    },
    {
      id: 'D004',
      name: 'David Lee',
      email: 'david.l@email.com',
      phone: '+1 (555) 444-5555',
      vehicleType: 'Compact',
      licensePlate: 'GHI-321',
      totalRides: 45,
      earnings: 1250.00,
      avgRating: 4.3,
      status: 'offline',
      verificationStatus: 'pending',
      joinDate: '2024-12-01',
      completionRate: 91.5
    },
    {
      id: 'D005',
      name: 'Anna Martinez',
      email: 'anna.m@email.com',
      phone: '+1 (555) 555-6666',
      vehicleType: 'Premium',
      licensePlate: 'JKL-654',
      totalRides: 634,
      earnings: 25890.00,
      avgRating: 4.8,
      status: 'online',
      verificationStatus: 'verified',
      joinDate: '2023-03-15',
      completionRate: 97.8
    },
  ];

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         driver.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         driver.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || driver.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: drivers.length,
    online: drivers.filter(d => d.status === 'online').length,
    busy: drivers.filter(d => d.status === 'busy').length,
    verified: drivers.filter(d => d.verificationStatus === 'verified').length,
  };

  const getStatusDot = (status: string) => {
    const colors = {
      online: 'bg-green-500',
      offline: 'bg-slate-400',
      busy: 'bg-yellow-500',
    };
    return colors[status as keyof typeof colors] || 'bg-slate-400';
  };

  const getVerificationBadge = (status: string) => {
    const styles = {
      verified: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.total}</h3>
          <p className="text-slate-600">Total Drivers</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <h3 className="text-2xl">{stats.online}</h3>
          </div>
          <p className="text-slate-600">Online Now</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <h3 className="text-2xl">{stats.busy}</h3>
          </div>
          <p className="text-slate-600">On Trip</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.verified}</h3>
          <p className="text-slate-600">Verified</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2>Driver List</h2>
              <p className="text-slate-600">Manage driver accounts and verification</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <UserPlus className="w-4 h-4" />
              Add Driver
            </button>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm text-slate-600">ID</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Driver</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Vehicle</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rides</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Earnings</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rating</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Status</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Verification</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{driver.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600">{driver.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm">{driver.name}</p>
                        <p className="text-xs text-slate-500">{driver.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{driver.vehicleType}</p>
                    <p className="text-xs text-slate-500">{driver.licensePlate}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{driver.totalRides}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">${driver.earnings.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{driver.avgRating}</span>
                      <span className="text-yellow-500">★</span>
                    </div>
                    <p className="text-xs text-slate-500">{driver.completionRate}% complete</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusDot(driver.status)}`}></div>
                      <span className="text-sm capitalize">{driver.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${getVerificationBadge(driver.verificationStatus)}`}>
                      {driver.verificationStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-2 hover:bg-slate-100 rounded-lg transition">
                      <MoreVertical className="w-4 h-4 text-slate-600" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {filteredDrivers.length} of {drivers.length} drivers
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm">
              Previous
            </button>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
