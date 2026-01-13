export type UserRole = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export type AuthenticatedUser = {
  userId: string;
  role: UserRole;
};
