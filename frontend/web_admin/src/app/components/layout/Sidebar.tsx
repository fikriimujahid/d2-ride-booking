import { useMemo, useState } from "react";
import { LogOut } from "lucide-react";
import { authStore } from "../../auth/authStore";
import { getAuthorizedMenuItems } from "./menuConfig";
import { Car } from "lucide-react";

interface SidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  onLogout: () => void;
}

/**
 * Sidebar with Permission-Based Menu Filtering
 * 
 * SECURITY NOTES:
 * 1. Menu items are filtered based on user permissions (UX only)
 * 2. Backend still enforces permissions on every API endpoint
 * 3. Permission checks use authStore.hasPermission() - simple array lookup
 * 
 * DESIGN:
 * - Only show menu items where user has the required "view" permission
 * - If user has zero authorized items, show empty state
 * - Auto-redirect to first authorized module if current module is unauthorized
 */
export function Sidebar({ activeModule, onModuleChange, onLogout }: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Get user info from admin context (preferred) or fallback to legacy user
  const adminContext = authStore.getAdminContext();
  const displayName = adminContext?.identity.name || authStore.getDisplayName();
  const displayEmail = adminContext?.identity.email || authStore.getEmail();

  // Compute initials for avatar
  const initials = useMemo(() => {
    const basis = displayName || displayEmail || '';
    if (!basis) return "--";

    const parts = basis
      .replace(/@.*/, "")
      .split(/\s+/)
      .filter(Boolean);

    const first = parts[0]?.[0] || basis[0];
    const second = (parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1]) || "";
    return `${first}${second}`.toUpperCase();
  }, [displayName, displayEmail]);

  // Filter menu items based on user permissions
  const authorizedMenuItems = useMemo(() => {
    return getAuthorizedMenuItems((permission) => authStore.hasPermission(permission));
  }, [adminContext?.permissions]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      onLogout();
    } finally {
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
        {authorizedMenuItems.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-gray-500">
            No authorized modules
          </div>
        )}
        
        {authorizedMenuItems.map((item) => {
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
              title={item.description}
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
