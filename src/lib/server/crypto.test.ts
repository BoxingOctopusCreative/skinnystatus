import { afterEach, describe, expect, it } from 'vitest';
import { decryptJson, encryptJson } from './crypto';
import { initConfig, resetConfigCache, resetDotEnvForTests } from './config';

function disableInfisicalForTests(): void {
	process.env.INFISICAL_DISABLE = '1';
}

afterEach(() => {
	resetConfigCache();
	delete process.env.CREDENTIALS_ENCRYPTION_KEY;
	delete process.env.INFISICAL_DISABLE;
	delete process.env.INFISICAL_CLIENT_ID;
	delete process.env.INFISICAL_CLIENT_SECRET;
	delete process.env.INFISICAL_PROJECT_ID;
});

describe('encryptJson / decryptJson', () => {
	it('round-trips JSON with AUTH_SECRET-derived key', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL =
			process.env.DATABASE_URL ||
			'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus';
		resetDotEnvForTests();
		resetConfigCache();
		disableInfisicalForTests();
		await initConfig();

		const payload = { token: 'secret-token', teamId: 'team_123' };
		const cipher = encryptJson(payload);
		expect(cipher).not.toContain('secret-token');
		expect(decryptJson(cipher)).toEqual(payload);
	});

	it('round-trips with explicit CREDENTIALS_ENCRYPTION_KEY hex', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL =
			process.env.DATABASE_URL ||
			'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus';
		process.env.CREDENTIALS_ENCRYPTION_KEY =
			'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
		resetDotEnvForTests();
		resetConfigCache();
		disableInfisicalForTests();
		await initConfig();

		const payload = { apiToken: 'cf-token', accountId: 'acct' };
		expect(decryptJson(encryptJson(payload))).toEqual(payload);
	});
});
