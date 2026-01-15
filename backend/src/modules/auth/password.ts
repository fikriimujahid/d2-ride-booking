import crypto from 'node:crypto';
import { AppError } from '../../shared/errors.js';

const SCRYPT_KEY_LEN = 64;
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// Why these constants exist: scrypt cost parameters are part of our security posture.
// If changed without migration: existing password hashes become unverifiable and all logins will fail.

type PasswordHashParts = {
  salt: Buffer;
  hash: Buffer;
};

function parseStoredPasswordHash(stored: string): PasswordHashParts {
  // Stored hash format is versioned-by-prefix:
  //   scrypt$<salt_b64>$<hash_b64>
  // Why: allows us to detect hash algorithm/format explicitly.
  // If removed: we'd accept ambiguous formats and risk silently weakening verification.
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    throw new AppError('Invalid password hash format', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  const salt = Buffer.from(parts[1] ?? '', 'base64');
  const hash = Buffer.from(parts[2] ?? '', 'base64');

  if (salt.length < 16 || hash.length !== SCRYPT_KEY_LEN) {
    // Why: minimum salt length prevents low-entropy salts; fixed hash length ensures parameters match.
    throw new AppError('Invalid password hash parameters', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  return { salt, hash };
}

async function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  // Why: Node's crypto.scrypt is callback-based; we wrap it to keep async/await flow.
  return await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) return reject(err);
        if (!Buffer.isBuffer(derivedKey)) {
          // If removed: a weird runtime type could bypass verification or crash later.
          return reject(new AppError('Invalid derived key type', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' }));
        }
        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  // Why: random salt ensures identical passwords do not produce identical hashes.
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const { salt, hash } = parseStoredPasswordHash(storedHash);
  const derived = await scryptAsync(password, salt);

  if (derived.length !== hash.length) return false;
  // Why: timingSafeEqual prevents timing side-channels that could leak information about the hash.
  // If removed: attackers may be able to statistically infer correct bytes over many attempts.
  return crypto.timingSafeEqual(derived, hash);
}
