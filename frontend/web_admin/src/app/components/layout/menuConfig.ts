import { 
  LayoutDashboard, 
  Users, 
  Car, 
  AlertCircle, 
  DollarSign, 
  BarChart3, 
  Shield, 
  Settings, 
  UserCog,
  type LucideIcon
} from "lucide-react";

/**
 * Menu Item Configuration with Permission Requirements
 * 
 * DESIGN PRINCIPLES:
 * 1. Permission-Based (NOT Role-Based): Each menu item requires specific permissions
 * 2. Frontend UX Only: Backend still enforces permissions on API endpoints
 * 3. Migration-Ready: Permission keys are stable strings independent of auth provider
 * 
 * PERMISSION MAPPING:
 * - Each menu item specifies ONE primary permission required to view it
 * - Use the most basic "view" permission for the module
 * - Backend may require additional permissions for specific actions within the module
 * 
 * USAGE:
 * - Import this config in Sidebar component
 * - Filter menu items based on authStore.hasPermission()
 * - Only show items where user has the required permission
 */

export interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  requiredPermission: string; // Permission key required to view this menu item
  description?: string;       // Optional tooltip/description
}

/**
 * Admin Menu Configuration
 * 
 * Each item maps to a module in the admin shell and requires a specific permission.
 * The permission model ensures:
 * - Support admins see read-only modules (dashboard, passengers, drivers, disputes, analytics)
 * - Ops admins see operational modules (+ pricing, fraud)
 * - Super admins see all modules (+ admins, settings)
 */
export const adminMenuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Live Operations",
    icon: LayoutDashboard,
    requiredPermission: "admin.dashboard.view",
    description: "Real-time ride monitoring and system overview"
  },
  {
    id: "passengers",
    label: "Passengers",
    icon: Users,
    requiredPermission: "admin.passengers.view",
    description: "Manage and monitor all registered passengers"
  },
  {
    id: "drivers",
    label: "Drivers",
    icon: Car,
    requiredPermission: "admin.drivers.view",
    description: "Manage and monitor all registered drivers"
  },
  {
    id: "disputes",
    label: "Disputes",
    icon: AlertCircle,
    requiredPermission: "admin.disputes.view",
    description: "Handle and resolve ride disputes"
  },
  {
    id: "pricing",
    label: "Pricing & Promos",
    icon: DollarSign,
    requiredPermission: "admin.pricing.view",
    description: "Configure pricing rules and promotional campaigns"
  },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    requiredPermission: "admin.analytics.view",
    description: "Performance metrics and business intelligence"
  },
  {
    id: "fraud",
    label: "Fraud Detection",
    icon: Shield,
    requiredPermission: "admin.fraud.view",
    description: "Security monitoring and administrative logs"
  },
  {
    id: "admins",
    label: "Admin Management",
    icon: UserCog,
    requiredPermission: "admin.admins.view",
    description: "Manage administrators, roles, and permissions"
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    requiredPermission: "admin.settings.view",
    description: "Configure platform settings and permissions"
  }
];

/**
 * Get filtered menu items based on user permissions
 * 
 * @param hasPermission - Function that checks if user has a permission
 * @returns Array of menu items the user is authorized to see
 */
export function getAuthorizedMenuItems(
  hasPermission: (permission: string) => boolean
): MenuItem[] {
  return adminMenuItems.filter(item => hasPermission(item.requiredPermission));
}

/**
 * Check if a module requires a specific permission for editing
 * 
 * Helper to determine if actions within a module should be disabled.
 * Returns the "edit/manage" permission for a given module.
 */
export function getModuleEditPermission(moduleId: string): string | null {
  const editPermissions: Record<string, string> = {
    dashboard: "admin.dashboard.control",
    passengers: "admin.passengers.edit",
    drivers: "admin.drivers.edit",
    disputes: "admin.disputes.resolve",
    pricing: "admin.pricing.manage",
    analytics: "admin.analytics.export",
    fraud: "admin.fraud.investigate",
    admins: "admin.admins.manage",
    settings: "admin.settings.manage"
  };
  
  return editPermissions[moduleId] || null;
}
