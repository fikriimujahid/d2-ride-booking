export type UserRole = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export type PermissionCode =
  | 'admin:rbac:read'
  | 'admin:rbac:write'
  | 'admin:users:read'
  | 'admin:users:write';

export type AuthenticatedUser = {
  userId: string;
  role: UserRole;
};
