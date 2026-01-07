import crypto from 'node:crypto';

export function base64url(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function randomTokenString(bytes = 32) {
  return base64url(crypto.randomBytes(bytes));
}

export function sha256(data: string | Buffer) {
  return crypto.createHash('sha256').update(data).digest();
}

export function uuidV4() {
  return crypto.randomUUID();
}

export function aes256gcmEncrypt(plaintext: Buffer, key: Buffer) {
  if (key.length !== 32) throw new Error('AES-256-GCM key must be 32 bytes');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function aes256gcmDecrypt(payload: Buffer, key: Buffer) {
  if (key.length !== 32) throw new Error('AES-256-GCM key must be 32 bytes');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
