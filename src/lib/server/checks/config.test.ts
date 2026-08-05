import { afterEach, describe, expect, it } from 'vitest';
import { decryptJson } from '../crypto';
import { initConfig, resetConfigCache, resetDotEnvForTests } from '../config';
import {
	parseCheckFieldsFromForm,
	sslDaysRemaining,
	toPublicCheckSettings
} from './config';
import { resolveServiceStatus } from '$lib/status';

function disableInfisicalForTests(): void {
	process.env.INFISICAL_DISABLE = '1';
}

async function readyCrypto(): Promise<void> {
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
}

afterEach(() => {
	resetConfigCache();
	delete process.env.CREDENTIALS_ENCRYPTION_KEY;
	delete process.env.INFISICAL_DISABLE;
});

describe('sslDaysRemaining', () => {
	it('returns positive days before expiry', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const notAfter = new Date('2026-01-15T00:00:00Z');
		expect(sslDaysRemaining(notAfter, now)).toBe(14);
	});

	it('returns negative days after expiry', () => {
		const now = new Date('2026-01-20T00:00:00Z');
		const notAfter = new Date('2026-01-15T00:00:00Z');
		expect(sslDaysRemaining(notAfter, now)).toBe(-5);
	});
});

describe('parseCheckFieldsFromForm', () => {
	it('clears check when type is empty', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', '');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.checkType).toBeNull();
			expect(parsed.value.checkUrl).toBeNull();
			expect(parsed.value.checkConfig).toBeNull();
		}
	});

	it('parses HTTP checks', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'http');
		form.set('checkUrl', 'https://example.com/health');
		form.set('expectedStatus', '204');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value).toEqual({
				checkType: 'http',
				checkUrl: 'https://example.com/health',
				expectedStatus: 204,
				checkConfig: null
			});
		}
	});

	it('requires URL for HTTP', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'http');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(false);
	});

	it('encrypts TCP config', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'tcp');
		form.set('host', 'db.internal');
		form.set('port', '5432');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.value.checkType).toBe('tcp');
			expect(parsed.value.checkConfig).toBeTruthy();
			expect(decryptJson(parsed.value.checkConfig!)).toEqual({
				host: 'db.internal',
				port: 5432
			});
		}
	});

	it('requires password for authenticated postgres on create', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'postgres');
		form.set('host', 'localhost');
		form.set('authenticated', 'on');
		form.set('user', 'app');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(false);
	});

	it('keeps existing password when blank on update', async () => {
		await readyCrypto();
		const create = new FormData();
		create.set('checkType', 'postgres');
		create.set('host', 'localhost');
		create.set('port', '5432');
		create.set('authenticated', 'on');
		create.set('user', 'app');
		create.set('password', 's3cret');
		const created = parseCheckFieldsFromForm(create);
		expect(created.ok).toBe(true);
		if (!created.ok) return;

		const update = new FormData();
		update.set('checkType', 'postgres');
		update.set('host', 'localhost');
		update.set('port', '5432');
		update.set('authenticated', 'on');
		update.set('user', 'app');
		update.set('password', '');
		const updated = parseCheckFieldsFromForm(update, {
			checkType: 'postgres',
			checkConfig: created.value.checkConfig
		});
		expect(updated.ok).toBe(true);
		if (updated.ok) {
			expect(decryptJson(updated.value.checkConfig!)).toMatchObject({
				password: 's3cret'
			});
		}
	});
});

describe('toPublicCheckSettings', () => {
	it('strips secrets from postgres config', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'postgres');
		form.set('host', 'db.example');
		form.set('authenticated', 'on');
		form.set('user', 'app');
		form.set('password', 's3cret');
		form.set('database', 'appdb');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const pub = toPublicCheckSettings('postgres', parsed.value.checkConfig);
		expect(pub).toEqual({
			type: 'postgres',
			host: 'db.example',
			port: 5432,
			authenticated: true,
			database: 'appdb',
			user: 'app',
			ssl: false,
			hasPassword: true
		});
		expect(JSON.stringify(pub)).not.toContain('s3cret');
	});
});

describe('resolveServiceStatus', () => {
	it('uses checkType for monitoring even without checkUrl', () => {
		expect(
			resolveServiceStatus({
				manualStatus: null,
				checkType: 'tcp',
				checkUrl: null,
				latestOk: false,
				latestLatencyMs: 10,
				degradedLatencyMs: 2000
			})
		).toBe('major_outage');
	});

	it('stays operational when no check configured', () => {
		expect(
			resolveServiceStatus({
				manualStatus: null,
				checkType: null,
				checkUrl: null,
				latestOk: false,
				latestLatencyMs: 10,
				degradedLatencyMs: 2000
			})
		).toBe('operational');
	});
});
