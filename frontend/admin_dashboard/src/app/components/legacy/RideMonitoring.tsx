import { useState } from 'react';
import { Search, Filter, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface Ride {
  id: string;
  passenger: string;
  driver: string;
  pickupLocation: string;
  dropoffLocation: string;
  fare: number;
  distance: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'disputed' | 'in_progress';
  timestamp: string;
  paymentMethod: string;
}

export default function RideMonitoring() {
  const [filter, setFilter] = useState<string>('all');

  const rides: Ride[] = [
    {
      id: 'R12345',
      passenger: 'Sarah Johnson',
      driver: 'John Smith',
      pickupLocation: '123 Main St',
      dropoffLocation: '456 Park Ave',
      fare: 24.50,
      distance: 8.5,
      duration: 18,
      status: 'completed',
      timestamp: '10 mins ago',
      paymentMethod: 'Card'
    },
    {
      id: 'R12346',
      passenger: 'Michael Chen',
      driver: 'Mike Davis',
      pickupLocation: '789 Oak Blvd',
      dropoffLocation: '321 Elm St',
      fare: 18.75,
      distance: 6.2,
      duration: 15,
      status: 'in_progress',
      timestamp: 'Now',
      paymentMethod: 'Cash'
    },
    {
      id: 'R12347',
      passenger: 'Emily Davis',
      driver: 'Lisa Brown',
      pickupLocation: '555 Broadway',
      dropoffLocation: '888 5th Ave',
      fare: 32.00,
      distance: 12.3,
      duration: 25,
      status: 'disputed',
      timestamp: '1 hour ago',
      paymentMethod: 'Card'
    },
    {
      id: 'R12348',
      passenger: 'Tom Wilson',
      driver: 'David Lee',
      pickupLocation: '999 Market St',
      dropoffLocation: '111 Center Dr',
      fare: 15.50,
      distance: 4.8,
      duration: 12,
      status: 'cancelled',
      timestamp: '2 hours ago',
      paymentMethod: 'Wallet'
    },
    {
      id: 'R12349',
      passenger: 'Lisa Anderson',
      driver: 'Anna Martinez',
      pickupLocation: '222 Hill Rd',
      dropoffLocation: '444 Valley Way',
      fare: 45.25,
      distance: 18.2,
      duration: 32,
      status: 'completed',
      timestamp: '3 hours ago',
      paymentMethod: 'Card'
    },
  ];

  const filteredRides = filter === 'all' ? rides : rides.filter(r => r.status === filter);

  const stats = {
    total: rides.length,
    completed: rides.filter(r => r.status === 'completed').length,
    inProgress: rides.filter(r => r.status === 'in_progress').length,
    disputed: rides.filter(r => r.status === 'disputed').length,
    cancelled: rides.filter(r => r.status === 'cancelled').length,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'disputed':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: 'bg-green-100 text-green-700',
      in_progress: 'bg-blue-100 text-blue-700',
      disputed: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-2xl mb-1">{stats.total}</h3>
          <p className="text-slate-600">Total Rides</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="text-2xl">{stats.completed}</h3>
          </div>
          <p className="text-slate-600">Completed</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h3 className="text-2xl">{stats.inProgress}</h3>
          </div>
          <p className="text-slate-600">In Progress</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <h3 className="text-2xl">{stats.disputed}</h3>
          </div>
          <p className="text-slate-600">Disputed</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-2xl">{stats.cancelled}</h3>
          </div>
          <p className="text-slate-600">Cancelled</p>
        </div>
      </div>

      {/* Ride List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2>Ride History</h2>
              <p className="text-slate-600">Monitor all ride activities</p>
            </div>
            <div className="flex gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="all">All Rides</option>
                <option value="completed">Completed</option>
                <option value="in_progress">In Progress</option>
                <option value="disputed">Disputed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {filteredRides.map((ride) => (
            <div key={ride.id} className="p-6 hover:bg-slate-50 transition">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  {getStatusIcon(ride.status)}
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm">{ride.id}</span>
                      <span className={`text-xs px-3 py-1 rounded-full ${getStatusBadge(ride.status)}`}>
                        {ride.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{ride.timestamp}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h3 className="mb-1">${ride.fare}</h3>
                  <p className="text-xs text-slate-500">{ride.paymentMethod}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Passenger</p>
                  <p className="text-sm">{ride.passenger}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Driver</p>
                  <p className="text-sm">{ride.driver}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Distance & Duration</p>
                  <p className="text-sm">{ride.distance} mi · {ride.duration} min</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Route</p>
                  <p className="text-sm text-slate-600">{ride.pickupLocation} → {ride.dropoffLocation}</p>
                </div>
              </div>

              {ride.status === 'disputed' && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <span className="text-sm text-orange-700">Dispute Pending Resolution</span>
                    </div>
                    <button className="text-sm text-orange-600 hover:text-orange-700 underline">
                      Review
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {filteredRides.length} rides
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition text-sm">
              Load More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
