export const SYSTEM_ROLES = {
    PASSENGER: 'PASSENGER',
    DRIVER: 'DRIVER',
    ADMIN: 'ADMIN'
} as const;

export type SystemRoleName = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

export const PRIVILEGED_SYSTEM_ROLES = [
    SYSTEM_ROLES.PASSENGER,
    SYSTEM_ROLES.DRIVER
] as const;

export type PrivilegedSystemRoleName = typeof PRIVILEGED_SYSTEM_ROLES[number];
