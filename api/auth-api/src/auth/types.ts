export type UserType = 'ADMIN' | 'DRIVER' | 'PASSENGER';

export type AuthContext = {
  userId: string;
  userType: UserType;
  audience: string;
  // NOTE: permissions are authorization data and must NOT come from JWT.
  // If permissions are needed during request handling, they must be loaded from DB.
  permissions?: string[];
};
