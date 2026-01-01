export const Permissions = {
    VIEW_DASHBOARD: 'view:dashboard',
    MANAGE_RIDES: 'manage:rides',
    MANAGE_USERS: 'manage:users',
    VIEW_USERS: 'view:users',
    HANDLE_DISPUTES: 'handle:disputes',
    GENERATE_REPORTS: 'generate:reports',
    ALL_ACCESS: '*'
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

export const RolePermissions: Record<string, Permission[]> = {
    SUPER_ADMIN: [Permissions.ALL_ACCESS],
    OPERATIONS_MANAGER: [
        Permissions.VIEW_DASHBOARD,
        Permissions.MANAGE_RIDES,
        Permissions.MANAGE_USERS,
        Permissions.HANDLE_DISPUTES
    ],
    SUPPORT_AGENT: [
        Permissions.VIEW_DASHBOARD,
        Permissions.VIEW_USERS,
        Permissions.HANDLE_DISPUTES
    ],
    ANALYST: [
        Permissions.VIEW_DASHBOARD,
        Permissions.GENERATE_REPORTS
    ],
    // Legacy Admin support
    ADMIN: [Permissions.ALL_ACCESS],
    PASSENGER: [],
    DRIVER: []
};
