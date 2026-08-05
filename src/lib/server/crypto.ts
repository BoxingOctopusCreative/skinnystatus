import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { getConfig } from '$lib/server/config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function resolveKeyBytes(): Buffer {
	const raw = process.env.CREDENTIALS_ENCRYPTION_KEY?.trim();
	if (raw) {
		if (/^[0-9a-fA-F]{64}$/.test(raw)) {
			return Buffer.from(raw, 'hex');
		}
		const fromB64 = Buffer.from(raw, 'base64');
		if (fromB64.length === KEY_LEN) return fromB64;
		throw new Error(
			'CREDENTIALS_ENCRYPTION_KEY must be 32 bytes as hex (64 chars) or base64'
		);
	}

	const secret = getConfig().auth.secret;
	return Buffer.from(
		hkdfSync('sha256', secret, 'skinnystatus-host-creds', 'aes-256-gcm-key', KEY_LEN)
	);
}

/** Encrypt a JSON-serializable value. Returns base64(iv || ciphertext || tag). */
export function encryptJson(value: unknown): string {
	const key = resolveKeyBytes();
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv(ALGO, key, iv);
	const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
	const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/** Decrypt a payload produced by encryptJson. */
export function decryptJson<T>(ciphertext: string): T {
	const key = resolveKeyBytes();
	const buf = Buffer.from(ciphertext, 'base64');
	if (buf.length < IV_LEN + TAG_LEN + 1) {
		throw new Error('Invalid ciphertext');
	}
	const iv = buf.subarray(0, IV_LEN);
	const tag = buf.subarray(buf.length - TAG_LEN);
	const encrypted = buf.subarray(IV_LEN, buf.length - TAG_LEN);
	const decipher = createDecipheriv(ALGO, key, iv);
	decipher.setAuthTag(tag);
	const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
	return JSON.parse(plaintext.toString('utf8')) as T;
}
