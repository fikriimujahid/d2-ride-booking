import { useMemo, useState } from "react";
import { LayoutDashboard, Users, Car, AlertCircle, DollarSign, BarChart3, Shield, Settings, LogOut } from "lucide-react";
import { adminLogout } from "../../api/auth";
import { authStore } from "../../auth/authStore";

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  onLogout: () => void;
}

const menuItems = [
  { id: "dashboard", label: "Live Operations", icon: LayoutDashboard },
  { id: "passengers", label: "Passengers", icon: Users },
  { id: "drivers", label: "Drivers", icon: Car },
  { id: "disputes", label: "Disputes", icon: AlertCircle },
  { id: "pricing", label: "Pricing & Promos", icon: DollarSign },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "fraud", label: "Fraud Detection", icon: Shield },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({ activeModule, onModuleChange, onLogout }: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = authStore.getUser();
  const displayName = user?.full_name?.trim() || user?.email?.split("@")[0] || "Admin";
  const displayEmail = user?.email || "";

  const initials = useMemo(() => {
    const basis = (user?.full_name?.trim() || user?.email || "").trim();
    if (!basis) return "--";

    const parts = basis
      .replace(/@.*/, "")
      .split(/\s+/)
      .filter(Boolean);

    const first = parts[0]?.[0] || basis[0];
    const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) || "";
    return `${first}${second}`.toUpperCase();
  }, [user?.full_name, user?.email]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await adminLogout();
    } catch {
      // Even if the API call fails (token expired/network), clear local session.
    } finally {
      authStore.clear();
      onLogout();
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Car className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">RideAdmin</h1>
            <p className="text-xs text-gray-500">Control Center</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onModuleChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-600">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-60"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
