import { afterEach, describe, expect, it } from 'vitest';
import {
	getConfig,
	initConfig,
	isPostgresUrl,
	resetConfigCache,
	resetDotEnvForTests
} from './config';

const PG_URL = 'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus';

/** Prevent Infisical from running during unit tests (project .env may have real creds). */
function disableInfisicalForTests(): void {
	process.env.INFISICAL_DISABLE = '1';
}

afterEach(() => {
	resetConfigCache();
	delete process.env.DATABASE_URL;
	delete process.env.SITE_DESCRIPTION;
	delete process.env.CHECKS_INTERVAL_SECONDS;
	delete process.env.SITE_NAME;
	delete process.env.INFISICAL_DISABLE;
	delete process.env.INFISICAL_CLIENT_ID;
	delete process.env.INFISICAL_CLIENT_SECRET;
	delete process.env.INFISICAL_PROJECT_ID;
});

describe('getConfig / initConfig', () => {
	it('prefers environment variables over defaults for configurable fields', async () => {
		disableInfisicalForTests();
		process.env.SITE_NAME = 'Ignored Brand';
		process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/from-env';
		resetConfigCache();

		await initConfig();
		const config = getConfig();
		expect(config.site.name).toBe('SkinnyStatus');
		expect(config.database.url).toBe('postgresql://user:pass@localhost:5432/from-env');
	});

	it('uses built-in defaults when env is unset', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		await initConfig();
		delete process.env.SITE_DESCRIPTION;
		delete process.env.CHECKS_INTERVAL_SECONDS;
		resetConfigCache();
		resetDotEnvForTests();
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		delete process.env.SITE_DESCRIPTION;

		await initConfig();
		const config = getConfig();
		expect(config.site.name).toBe('SkinnyStatus');
		expect(config.database.url).toBe(PG_URL);
		expect(isPostgresUrl(config.database.url)).toBe(true);
	});

	it('loads ORIGIN from the project .env file', async () => {
		disableInfisicalForTests();
		delete process.env.ORIGIN;
		process.env.DATABASE_URL = PG_URL;
		resetDotEnvForTests();
		resetConfigCache();
		disableInfisicalForTests();

		await initConfig();
		const config = getConfig();
		expect(config.site.baseUrl).toBe('http://localhost:5173');
	});

	it('rejects non-Postgres DATABASE_URL', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL = 'file:./data/skinnystatus.db';
		resetConfigCache();
		resetDotEnvForTests();
		disableInfisicalForTests();

		await expect(initConfig()).rejects.toThrow(/Postgres URL/);
	});

	it('throws from getConfig before initConfig', () => {
		resetConfigCache();
		expect(() => getConfig()).toThrow(/initConfig/);
	});
});
