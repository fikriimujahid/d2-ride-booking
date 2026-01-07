export type UserType = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export type AuthContext = {
  userId: string;
  userType: UserType;
  audience: string;
  permissions?: string[];
};
