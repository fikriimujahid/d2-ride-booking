import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { Activity, Car, Users, DollarSign, Clock, Navigation } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface ActiveRide {
  id: string;
  driverId: string;
  driverName: string;
  passengerId: string;
  passengerName: string;
  pickup: [number, number];
  dropoff: [number, number];
  currentLocation: [number, number];
  status: 'picking_up' | 'in_ride' | 'arriving';
  eta: number;
  fare: number;
}

export default function LiveOperations() {
  const [activeRides, setActiveRides] = useState<ActiveRide[]>([
    {
      id: 'R001',
      driverId: 'D123',
      driverName: 'John Smith',
      passengerId: 'P456',
      passengerName: 'Sarah Johnson',
      pickup: [37.7749, -122.4194],
      dropoff: [37.7849, -122.4094],
      currentLocation: [37.7779, -122.4164],
      status: 'in_ride',
      eta: 8,
      fare: 24.50
    },
    {
      id: 'R002',
      driverId: 'D124',
      driverName: 'Mike Davis',
      passengerId: 'P457',
      passengerName: 'Tom Wilson',
      pickup: [37.7649, -122.4294],
      dropoff: [37.7949, -122.4394],
      currentLocation: [37.7679, -122.4314],
      status: 'picking_up',
      eta: 3,
      fare: 18.75
    },
    {
      id: 'R003',
      driverId: 'D125',
      driverName: 'Lisa Brown',
      passengerId: 'P458',
      passengerName: 'Emma Davis',
      pickup: [37.7849, -122.4094],
      dropoff: [37.7649, -122.3994],
      currentLocation: [37.7829, -122.4084],
      status: 'arriving',
      eta: 1,
      fare: 32.00
    },
  ]);

  const stats = {
    activeRides: activeRides.length,
    availableDrivers: 127,
    totalRevenue: 15847.50,
    avgWaitTime: 4.2
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-green-600">Live</span>
          </div>
          <h3 className="text-2xl mb-1">{stats.activeRides}</h3>
          <p className="text-slate-600">Active Rides</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Car className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-blue-600">Online</span>
          </div>
          <h3 className="text-2xl mb-1">{stats.availableDrivers}</h3>
          <p className="text-slate-600">Available Drivers</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm text-green-600">+12%</span>
          </div>
          <h3 className="text-2xl mb-1">${stats.totalRevenue.toLocaleString()}</h3>
          <p className="text-slate-600">Today's Revenue</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm text-green-600">-8%</span>
          </div>
          <h3 className="text-2xl mb-1">{stats.avgWaitTime} min</h3>
          <p className="text-slate-600">Avg Wait Time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2>Live Ride Map</h2>
            <p className="text-slate-600">Real-time tracking of active rides</p>
          </div>
          <div className="h-[500px]">
            <MapContainer
              center={[37.7749, -122.4194]}
              zoom={13}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {activeRides.map((ride) => (
                <Marker key={ride.id} position={ride.currentLocation}>
                  <Popup>
                    <div className="p-2">
                      <p><strong>Ride ID:</strong> {ride.id}</p>
                      <p><strong>Driver:</strong> {ride.driverName}</p>
                      <p><strong>Passenger:</strong> {ride.passengerName}</p>
                      <p><strong>ETA:</strong> {ride.eta} min</p>
                      <p><strong>Fare:</strong> ${ride.fare}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Active Rides List */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-4 border-b border-slate-200">
            <h2>Active Rides</h2>
            <p className="text-slate-600">Current in-progress rides</p>
          </div>
          <div className="p-4 space-y-3 max-h-[500px] overflow-auto">
            {activeRides.map((ride) => (
              <div key={ride.id} className="p-3 border border-slate-200 rounded-lg hover:border-blue-300 transition">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <Navigation className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm">{ride.id}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        ride.status === 'in_ride' ? 'bg-blue-100 text-blue-700' :
                        ride.status === 'picking_up' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {ride.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <span className="text-sm">${ride.fare}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-600">
                    <strong>Driver:</strong> {ride.driverName}
                  </p>
                  <p className="text-slate-600">
                    <strong>Passenger:</strong> {ride.passengerName}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-xs text-slate-500">ETA: {ride.eta} min</span>
                    <button className="text-xs text-blue-600 hover:text-blue-700">Track</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heat Map Zones */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="mb-4">Demand Heat Zones</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { zone: 'Downtown', demand: 'High', multiplier: '2.5x', color: 'bg-red-500' },
            { zone: 'Airport', demand: 'Medium', multiplier: '1.8x', color: 'bg-orange-500' },
            { zone: 'Suburbs', demand: 'Low', multiplier: '1.0x', color: 'bg-green-500' },
          ].map((zone) => (
            <div key={zone.zone} className="p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${zone.color}`}></div>
                <span>{zone.zone}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Demand: {zone.demand}</span>
                <span className="px-2 py-1 bg-slate-100 rounded">
                  {zone.multiplier}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
