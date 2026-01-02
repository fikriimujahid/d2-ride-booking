export type SystemGroup = 'Admin' | 'Passenger' | 'Driver';

export type AuthContext = {
  sub: string;
  email?: string;
  tokenUse: 'access' | 'id';
  groups: SystemGroup[];
  amr: string[];
  rawClaims: Record<string, unknown>;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
