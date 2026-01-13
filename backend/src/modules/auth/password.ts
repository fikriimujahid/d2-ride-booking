import crypto from 'node:crypto';
import { AppError } from '../../shared/errors.js';

const SCRYPT_KEY_LEN = 64;
const SCRYPT_N = 2 ** 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

type PasswordHashParts = {
  salt: Buffer;
  hash: Buffer;
};

function parseStoredPasswordHash(stored: string): PasswordHashParts {
  // Format: scrypt$<salt_b64>$<hash_b64>
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    throw new AppError('Invalid password hash format', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  const salt = Buffer.from(parts[1] ?? '', 'base64');
  const hash = Buffer.from(parts[2] ?? '', 'base64');

  if (salt.length < 16 || hash.length !== SCRYPT_KEY_LEN) {
    throw new AppError('Invalid password hash parameters', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  return { salt, hash };
}

async function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) return reject(err);
        if (!Buffer.isBuffer(derivedKey)) {
          return reject(new AppError('Invalid derived key type', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' }));
        }
        resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const { salt, hash } = parseStoredPasswordHash(storedHash);
  const derived = await scryptAsync(password, salt);

  if (derived.length !== hash.length) return false;
  return crypto.timingSafeEqual(derived, hash);
}
