import { authenticator } from 'otplib';

export function generateTotpSecret() {
  const secret = authenticator.generateSecret();
  return secret;
}

export function buildOtpauthUri(opts: { issuer: string; accountName: string; secret: string }) {
  return authenticator.keyuri(opts.accountName, opts.issuer, opts.secret);
}

export function verifyTotp(code: string, secret: string) {
  // allow a small time drift
  authenticator.options = { window: 1 };
  return authenticator.check(code, secret);
}
