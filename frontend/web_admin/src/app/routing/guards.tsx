import { authStore } from "../auth/authStore";
import { adminMenuItems } from "../components/layout/menuConfig";

/**
 * Route Guard Utilities
 * 
 * Provides permission-based route protection for the admin application.
 * 
 * SECURITY PRINCIPLES:
 * 1. Frontend guards are UX-only (prevent navigation to unauthorized routes)
 * 2. Backend still enforces permissions on every API endpoint
 * 3. Guards use simple permission checks (authStore.hasPermission)
 * 
 * USAGE:
 * - Use canAccessModule() to check if user can access a specific module
 * - Use getDefaultModule() to get the first authorized module for redirects
 * - Use requirePermission() wrapper for components that need specific permissions
 */

/**
 * Check if user can access a specific module
 * 
 * @param moduleId - Module ID (e.g., "dashboard", "passengers")
 * @returns true if user has permission to view the module
 */
export function canAccessModule(moduleId: string): boolean {
  const menuItem = adminMenuItems.find(item => item.id === moduleId);
  if (!menuItem) return false;
  
  return authStore.hasPermission(menuItem.requiredPermission);
}

/**
 * Get the first authorized module for the current user
 * 
 * Used for default route redirect when user lands on /admin
 * or when current module becomes unauthorized.
 * 
 * @returns Module ID of first authorized module, or null if none
 */
export function getDefaultModule(): string | null {
  const authorizedItems = adminMenuItems.filter(item => 
    authStore.hasPermission(item.requiredPermission)
  );
  
  return authorizedItems[0]?.id || null;
}

/**
 * Get a safe module to redirect to
 * 
 * If requestedModule is authorized, return it.
 * Otherwise, return the first authorized module.
 * 
 * @param requestedModule - Requested module ID
 * @returns Safe module ID or null if user has no authorized modules
 */
export function getSafeModule(requestedModule: string): string | null {
  if (canAccessModule(requestedModule)) {
    return requestedModule;
  }
  
  return getDefaultModule();
}

/**
 * Permission Guard HOC
 * 
 * Wraps a component and only renders it if user has required permission.
 * Shows fallback UI if permission is missing.
 * 
 * @example
 * ```tsx
 * const ProtectedButton = requirePermission(
 *   'admin.users.delete',
 *   DeleteButton,
 *   <span className="text-gray-400">No permission</span>
 * );
 * ```
 */
export function requirePermission<P extends object>(
  permission: string,
  Component: React.ComponentType<P>,
  fallback: React.ReactNode = null
): React.FC<P> {
  return (props: P) => {
    if (!authStore.hasPermission(permission)) {
      return <>{fallback}</>;
    }
    
    return <Component {...props} />;
  };
}

/**
 * Multiple Permission Guard HOC
 * 
 * Requires ALL specified permissions (AND logic)
 */
export function requireAllPermissions<P extends object>(
  permissions: string[],
  Component: React.ComponentType<P>,
  fallback: React.ReactNode = null
): React.FC<P> {
  return (props: P) => {
    if (!authStore.hasAllPermissions(permissions)) {
      return <>{fallback}</>;
    }
    
    return <Component {...props} />;
  };
}

/**
 * Any Permission Guard HOC
 * 
 * Requires ANY of the specified permissions (OR logic)
 */
export function requireAnyPermission<P extends object>(
  permissions: string[],
  Component: React.ComponentType<P>,
  fallback: React.ReactNode = null
): React.FC<P> {
  return (props: P) => {
    if (!authStore.hasAnyPermission(permissions)) {
      return <>{fallback}</>;
    }
    
    return <Component {...props} />;
  };
}

/**
 * Hook: Check if user has permission (for functional components)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const canDelete = usePermission('admin.users.delete');
 *   
 *   return (
 *     <button disabled={!canDelete}>
 *       Delete User
 *     </button>
 *   );
 * }
 * ```
 */
export function usePermission(permission: string): boolean {
  // NOTE: This is a simple implementation without reactivity
  // For reactive updates, you'd need to integrate with a state management system
  return authStore.hasPermission(permission);
}

/**
 * Hook: Check if user has any of the permissions
 */
export function useAnyPermission(permissions: string[]): boolean {
  return authStore.hasAnyPermission(permissions);
}

/**
 * Hook: Check if user has all of the permissions
 */
export function useAllPermissions(permissions: string[]): boolean {
  return authStore.hasAllPermissions(permissions);
}

/**
 * Conditional Render Helper
 * 
 * Simple utility to show/hide UI elements based on permission
 * 
 * @example
 * ```tsx
 * <IfPermission permission="admin.users.delete">
 *   <button>Delete User</button>
 * </IfPermission>
 * ```
 */
interface IfPermissionProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function IfPermission({ permission, children, fallback = null }: IfPermissionProps) {
  if (!authStore.hasPermission(permission)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Multiple Permissions Conditional Render (AND logic)
 */
interface IfAllPermissionsProps {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function IfAllPermissions({ permissions, children, fallback = null }: IfAllPermissionsProps) {
  if (!authStore.hasAllPermissions(permissions)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * Multiple Permissions Conditional Render (OR logic)
 */
interface IfAnyPermissionProps {
  permissions: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function IfAnyPermission({ permissions, children, fallback = null }: IfAnyPermissionProps) {
  if (!authStore.hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
