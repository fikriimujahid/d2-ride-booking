import { MapPin, Navigation } from "lucide-react";

interface Ride {
  id: string;
  driver: string;
  passenger: string;
  status: "active" | "waiting" | "completed";
  position: { x: number; y: number };
}

const mockRides: Ride[] = [
  { id: "R001", driver: "John D.", passenger: "Sarah M.", status: "active", position: { x: 25, y: 30 } },
  { id: "R002", driver: "Mike S.", passenger: "Tom K.", status: "active", position: { x: 65, y: 45 } },
  { id: "R003", driver: "Lisa R.", passenger: "Emma W.", status: "waiting", position: { x: 40, y: 60 } },
  { id: "R004", driver: "David L.", passenger: "Alex P.", status: "active", position: { x: 80, y: 25 } },
  { id: "R005", driver: "Anna K.", passenger: "Chris B.", status: "active", position: { x: 50, y: 75 } },
];

export function LiveMap() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Live Ride Tracking</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-xs text-gray-600">Active ({mockRides.filter(r => r.status === "active").length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span className="text-xs text-gray-600">Waiting ({mockRides.filter(r => r.status === "waiting").length})</span>
          </div>
        </div>
      </div>

      <div className="relative bg-gray-100 rounded-lg h-[400px] overflow-hidden">
        {/* Map Grid */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="absolute left-0 right-0 border-t border-gray-300" style={{ top: `${i * 10}%` }} />
          ))}
          {[...Array(10)].map((_, i) => (
            <div key={i} className="absolute top-0 bottom-0 border-l border-gray-300" style={{ left: `${i * 10}%` }} />
          ))}
        </div>

        {/* Roads/Routes simulation */}
        <svg className="absolute inset-0 w-full h-full">
          <path d="M 0 150 Q 200 100 400 150 T 800 150" stroke="#d1d5db" strokeWidth="3" fill="none" />
          <path d="M 150 0 Q 100 200 150 400" stroke="#d1d5db" strokeWidth="3" fill="none" />
          <path d="M 600 0 Q 650 200 600 400" stroke="#d1d5db" strokeWidth="3" fill="none" />
        </svg>

        {/* Ride markers */}
        {mockRides.map((ride) => (
          <div
            key={ride.id}
            className="absolute group cursor-pointer"
            style={{
              left: `${ride.position.x}%`,
              top: `${ride.position.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className={`relative ${ride.status === "active" ? "animate-pulse" : ""}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                ride.status === "active" ? "bg-green-500" : "bg-yellow-500"
              }`}>
                {ride.status === "active" ? (
                  <Navigation className="w-4 h-4 text-white" />
                ) : (
                  <MapPin className="w-4 h-4 text-white" />
                )}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                  <p className="font-medium">{ride.id}</p>
                  <p className="text-gray-300">Driver: {ride.driver}</p>
                  <p className="text-gray-300">Passenger: {ride.passenger}</p>
                  <p className={`mt-1 ${ride.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
                    {ride.status === "active" ? "In Progress" : "Waiting"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
        <span>Last updated: Just now</span>
        <span>Refresh rate: Real-time</span>
      </div>
    </div>
  );
}
