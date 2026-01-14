import crypto from 'node:crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

export type TotpSetup = {
	secretBase32: string;
	otpauthUrl: string;
	qrCodeDataUrl: string;
};

function getAesKey(): Buffer {
	const key = Buffer.from(env.totpEncryptionKeyBase64, 'base64');
	if (key.length !== 32) {
		throw new AppError('Invalid TOTP encryption key', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
	}
	return key;
}

function assertOtpFormat(otp: string): void {
	if (!/^[0-9]{6}$/.test(otp)) {
		throw new AppError('Invalid OTP format', { statusCode: 400, code: 'VALIDATION_ERROR' });
	}
}

export function encryptTotpSecret(secretBase32: string): Buffer {
	const key = getAesKey();
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
	const ciphertext = Buffer.concat([cipher.update(secretBase32, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptTotpSecret(secretEnc: Buffer): string {
	if (secretEnc.length < 12 + 16 + 1) {
		throw new AppError('Invalid stored TOTP secret', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
	}

	const key = getAesKey();
	const iv = secretEnc.subarray(0, 12);
	const tag = secretEnc.subarray(12, 28);
	const ciphertext = secretEnc.subarray(28);

	try {
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(tag);
		const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
		return plaintext.toString('utf8');
	} catch (err) {
		throw new AppError('Failed to decrypt TOTP secret', { statusCode: 500, code: 'AUTH_CONFIG_ERROR', cause: err });
	}
}

export async function createTotpSetup(accountLabel: string): Promise<TotpSetup> {
	const secretBase32 = generateSecret();
	const otpauthUrl = generateURI({ issuer: env.totpIssuer, label: accountLabel, secret: secretBase32 });
	const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
	return { secretBase32, otpauthUrl, qrCodeDataUrl };
}

export function verifyTotpCode(secretBase32: string, otp: string): boolean {
	assertOtpFormat(otp);
	const result = verifySync({ secret: secretBase32, token: otp, epochTolerance: 30 });
	return result.valid;
}

