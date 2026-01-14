export type RoleLoginBody = {
  email: string;
  password: string;
  otp?: string;
};

export type Admin2faSetupBody = Record<string, never>;

export type Admin2faSetupResponse = {
  secretBase32: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
};

export type Admin2faVerifyBody = {
  otp: string;
};

export type Admin2faVerifyResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

export type Admin2faSetupRequiredResponse = {
  twoFactorRequired: true;
  setupToken: string;
  expiresAt: string;
};

export type AdminMfaChallengeResponse = {
  challengeName: 'SOFTWARE_TOKEN_MFA';
  session: string;
  expiresAt: string;
};

export type AdminMfaRespondBody = {
  session: string;
  otp: string;
};

export type AdminLoginResponse = Admin2faSetupRequiredResponse | AdminMfaChallengeResponse;

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

export const roleLoginBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    email: { type: 'string', minLength: 3, maxLength: 320 },
    password: { type: 'string', minLength: 8, maxLength: 200 },
    otp: { type: 'string', minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$' }
  },
  required: ['email', 'password']
} as const;

export const admin2faSetupBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {},
  required: []
} as const;

export const admin2faSetupResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    secretBase32: { type: 'string', minLength: 10, maxLength: 256 },
    otpauthUrl: { type: 'string', minLength: 10, maxLength: 4096 },
    qrCodeDataUrl: { type: 'string', minLength: 10, maxLength: 20000 }
  },
  required: ['secretBase32', 'otpauthUrl', 'qrCodeDataUrl']
} as const;

export const admin2faVerifyBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    otp: { type: 'string', minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$' }
  },
  required: ['otp']
} as const;

export const admin2faSetupRequiredResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    twoFactorRequired: { type: 'boolean', const: true },
    setupToken: { type: 'string', minLength: 20, maxLength: 4096 },
    expiresAt: { type: 'string' }
  },
  required: ['twoFactorRequired', 'setupToken', 'expiresAt']
} as const;

export const adminMfaChallengeResponseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    challengeName: { type: 'string', const: 'SOFTWARE_TOKEN_MFA' },
    session: { type: 'string', minLength: 20, maxLength: 4096 },
    expiresAt: { type: 'string' }
  },
  required: ['challengeName', 'session', 'expiresAt']
} as const;

export const adminMfaRespondBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    session: { type: 'string', minLength: 20, maxLength: 4096 },
    otp: { type: 'string', minLength: 6, maxLength: 6, pattern: '^[0-9]{6}$' }
  },
  required: ['session', 'otp']
} as const;

export const adminLoginResponseSchema = {
  oneOf: [admin2faSetupRequiredResponseSchema, adminMfaChallengeResponseSchema]
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

// tokenResponseSchema declared above (used by adminLoginResponseSchema)
