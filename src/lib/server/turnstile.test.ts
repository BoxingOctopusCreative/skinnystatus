import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	getConfig,
	initConfig,
	resetConfigCache,
	resetDotEnvForTests
} from './config';
import { isTurnstileConfigured, verifyTurnstileToken } from './turnstile';

const PG_URL = 'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus';

function disableInfisicalForTests(): void {
	process.env.INFISICAL_DISABLE = '1';
}

afterEach(() => {
	resetConfigCache();
	vi.unstubAllGlobals();
	delete process.env.DATABASE_URL;
	delete process.env.TURNSTILE_SITE_KEY;
	delete process.env.TURNSTILE_SECRET;
	delete process.env.INFISICAL_DISABLE;
});

describe('turnstile', () => {
	it('is disabled when secrets are unset', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		delete process.env.TURNSTILE_SITE_KEY;
		delete process.env.TURNSTILE_SECRET;
		resetDotEnvForTests();
		resetConfigCache();
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;

		await initConfig();
		expect(getConfig().turnstile.siteKey).toBeNull();
		expect(isTurnstileConfigured()).toBe(false);
		expect(await verifyTurnstileToken(undefined)).toBe(true);
	});

	it('verifies via siteverify when configured', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		process.env.TURNSTILE_SITE_KEY = 'sitekey-test';
		process.env.TURNSTILE_SECRET = 'secret-test';
		resetDotEnvForTests();
		resetConfigCache();
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		process.env.TURNSTILE_SITE_KEY = 'sitekey-test';
		process.env.TURNSTILE_SECRET = 'secret-test';

		await initConfig();
		expect(isTurnstileConfigured()).toBe(true);
		expect(await verifyTurnstileToken('')).toBe(false);

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true })
		});
		vi.stubGlobal('fetch', fetchMock);

		expect(await verifyTurnstileToken('token-abc', '1.2.3.4')).toBe(true);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			expect.objectContaining({ method: 'POST' })
		);
		const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
		expect(body.get('secret')).toBe('secret-test');
		expect(body.get('response')).toBe('token-abc');
		expect(body.get('remoteip')).toBe('1.2.3.4');
	});
});
