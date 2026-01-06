export const roles = ['admin', 'driver', 'passenger'] as const;
export type Role = (typeof roles)[number];

export type AuthContext = {
  userId: string;
  role: Role;
};
