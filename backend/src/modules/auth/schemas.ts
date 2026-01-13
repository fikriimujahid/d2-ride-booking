export type RoleLoginBody = {
  email: string;
  password: string;
};

export type RefreshBody = {
  refreshToken: string;
};

export type LogoutBody = {
  refreshToken: string;
};

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export const roleLoginBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    password: { type: 'string', minLength: 8, maxLength: 200 }
  },
  required: ['email', 'password']
} as const;

export const refreshBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    refreshToken: { type: 'string', minLength: 20, maxLength: 4096 }
  },
  required: ['refreshToken']
} as const;

export const logoutBodySchema = refreshBodySchema;

export const tokenResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresAt: { type: 'string' }
  },
  required: ['accessToken', 'refreshToken', 'expiresAt']
} as const;
