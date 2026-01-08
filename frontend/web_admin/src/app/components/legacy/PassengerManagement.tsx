import { useState } from 'react';
import { Search, Filter, Download, UserPlus, MoreVertical, MapPin, Clock, DollarSign } from 'lucide-react';

interface Passenger {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalRides: number;
  totalSpent: number;
  avgRating: number;
  status: 'active' | 'suspended' | 'verified';
  joinDate: string;
  lastRide: string;
}

export default function PassengerManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const passengers: Passenger[] = [
    {
      id: 'P001',
      name: 'Sarah Johnson',
      email: 'sarah.j@email.com',
      phone: '+1 (555) 123-4567',
      totalRides: 127,
      totalSpent: 3450.50,
      avgRating: 4.8,
      status: 'verified',
      joinDate: '2023-01-15',
      lastRide: '2 hours ago'
    },
    {
      id: 'P002',
      name: 'Michael Chen',
      email: 'michael.c@email.com',
      phone: '+1 (555) 234-5678',
      totalRides: 89,
      totalSpent: 2180.00,
      avgRating: 4.9,
      status: 'verified',
      joinDate: '2023-02-20',
      lastRide: '1 day ago'
    },
    {
      id: 'P003',
      name: 'Emily Davis',
      email: 'emily.d@email.com',
      phone: '+1 (555) 345-6789',
      totalRides: 45,
      totalSpent: 1250.75,
      avgRating: 4.6,
      status: 'active',
      joinDate: '2023-05-10',
      lastRide: '3 days ago'
    },
    {
      id: 'P004',
      name: 'James Wilson',
      email: 'james.w@email.com',
      phone: '+1 (555) 456-7890',
      totalRides: 12,
      totalSpent: 320.00,
      avgRating: 3.8,
      status: 'suspended',
      joinDate: '2023-08-01',
      lastRide: '2 weeks ago'
    },
    {
      id: 'P005',
      name: 'Lisa Anderson',
      email: 'lisa.a@email.com',
      phone: '+1 (555) 567-8901',
      totalRides: 203,
      totalSpent: 5670.25,
      avgRating: 5.0,
      status: 'verified',
      joinDate: '2022-11-05',
      lastRide: '5 hours ago'
    },
  ];

  const filteredPassengers = passengers.filter(passenger => {
    const matchesSearch = passenger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         passenger.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         passenger.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || passenger.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: passengers.length,
    verified: passengers.filter(p => p.status === 'verified').length,
    active: passengers.filter(p => p.status === 'active').length,
    suspended: passengers.filter(p => p.status === 'suspended').length,
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      verified: 'bg-green-100 text-green-700',
      active: 'bg-blue-100 text-blue-700',
      suspended: 'bg-red-100 text-red-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.total}</h3>
          <p className="text-slate-600">Total Passengers</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.verified}</h3>
          <p className="text-slate-600">Verified</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.active}</h3>
          <p className="text-slate-600">Active</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.suspended}</h3>
          <p className="text-slate-600">Suspended</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2>Passenger List</h2>
              <p className="text-slate-600">Manage and monitor passenger accounts</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <UserPlus className="w-4 h-4" />
              Add Passenger
            </button>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search passengers..."
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
              <option value="verified">Verified</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
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
                <th className="text-left px-6 py-4 text-sm text-slate-600">Passenger</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Contact</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rides</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Total Spent</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Rating</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Status</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Last Ride</th>
                <th className="text-left px-6 py-4 text-sm text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPassengers.map((passenger) => (
                <tr key={passenger.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{passenger.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600">{passenger.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm">{passenger.name}</p>
                        <p className="text-xs text-slate-500">Joined {passenger.joinDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm">{passenger.email}</p>
                    <p className="text-xs text-slate-500">{passenger.phone}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{passenger.totalRides}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">${passenger.totalSpent.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{passenger.avgRating}</span>
                      <span className="text-yellow-500">★</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadge(passenger.status)}`}>
                      {passenger.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{passenger.lastRide}</span>
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
            Showing {filteredPassengers.length} of {passengers.length} passengers
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
