import { afterEach, describe, expect, it } from 'vitest';
import { decryptJson } from '../crypto';
import { initConfig, resetConfigCache, resetDotEnvForTests } from '../config';
import { parseCheckFieldsFromForm, sslDaysRemaining, toPublicCheckSettings } from './config';
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

describe('HTTP check authentication', () => {
	function httpForm(fields: Record<string, string>): FormData {
		const form = new FormData();
		form.set('checkType', 'http');
		form.set('checkUrl', 'https://api.example.com/health');
		for (const [key, value] of Object.entries(fields)) form.set(key, value);
		return form;
	}

	it('stores no config when auth is off', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(httpForm({ httpAuthMode: 'none' }));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.checkConfig).toBeNull();
	});

	it('treats a missing auth mode as off, so existing checks keep working', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(httpForm({}));
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.checkConfig).toBeNull();
	});

	it('encrypts a bearer token', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(
			httpForm({ httpAuthMode: 'bearer', httpAuthToken: 'sk-live-123' })
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.checkConfig).not.toContain('sk-live-123');
		expect(decryptJson(parsed.value.checkConfig!)).toEqual({
			auth: 'bearer',
			token: 'sk-live-123'
		});
	});

	it('keeps the stored token when the field is left blank', async () => {
		await readyCrypto();
		const first = parseCheckFieldsFromForm(
			httpForm({ httpAuthMode: 'bearer', httpAuthToken: 'sk-live-123' })
		);
		expect(first.ok).toBe(true);
		if (!first.ok) return;

		const second = parseCheckFieldsFromForm(httpForm({ httpAuthMode: 'bearer' }), {
			checkType: 'http',
			checkConfig: first.value.checkConfig
		});
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(decryptJson(second.value.checkConfig!)).toEqual({
			auth: 'bearer',
			token: 'sk-live-123'
		});
	});

	it('does not carry a secret across a change of method', async () => {
		await readyCrypto();
		const bearer = parseCheckFieldsFromForm(
			httpForm({ httpAuthMode: 'bearer', httpAuthToken: 'sk-live-123' })
		);
		expect(bearer.ok).toBe(true);
		if (!bearer.ok) return;

		const switched = parseCheckFieldsFromForm(
			httpForm({ httpAuthMode: 'basic', httpAuthUsername: 'health' }),
			{ checkType: 'http', checkConfig: bearer.value.checkConfig }
		);
		expect(switched.ok).toBe(false);
		if (switched.ok) return;
		expect(switched.message).toMatch(/password is required/i);
	});

	it('does not reuse a database password as an HTTP credential', async () => {
		await readyCrypto();
		const dbForm = new FormData();
		dbForm.set('checkType', 'postgres');
		dbForm.set('host', 'db.internal');
		dbForm.set('authenticated', 'on');
		dbForm.set('user', 'app');
		dbForm.set('password', 'db-secret');
		const dbParsed = parseCheckFieldsFromForm(dbForm);
		expect(dbParsed.ok).toBe(true);
		if (!dbParsed.ok) return;

		const parsed = parseCheckFieldsFromForm(httpForm({ httpAuthMode: 'bearer' }), {
			checkType: 'postgres',
			checkConfig: dbParsed.value.checkConfig
		});
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.message).toMatch(/token is required/i);
	});

	it('requires a username for basic auth and rejects a colon in it', async () => {
		await readyCrypto();
		const missing = parseCheckFieldsFromForm(
			httpForm({ httpAuthMode: 'basic', httpAuthPassword: 'secret' })
		);
		expect(missing.ok).toBe(false);

		const colon = parseCheckFieldsFromForm(
			httpForm({
				httpAuthMode: 'basic',
				httpAuthUsername: 'user:name',
				httpAuthPassword: 'secret'
			})
		);
		expect(colon.ok).toBe(false);
		if (colon.ok) return;
		expect(colon.message).toMatch(/colon/i);
	});

	it('rejects a header name that is not a valid token', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(
			httpForm({
				httpAuthMode: 'header',
				httpAuthHeaderName: 'X-Bad Header',
				httpAuthHeaderValue: 'abc'
			})
		);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.message).toMatch(/header name/i);
	});

	it('rejects credentials containing a line break', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(
			httpForm({
				httpAuthMode: 'header',
				httpAuthHeaderName: 'X-API-Key',
				httpAuthHeaderValue: 'abc\r\nX-Admin: true'
			})
		);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.message).toMatch(/line breaks/i);
	});

	it('rejects an unknown auth mode', async () => {
		await readyCrypto();
		const parsed = parseCheckFieldsFromForm(httpForm({ httpAuthMode: 'oauth' }));
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.message).toMatch(/authentication method/i);
	});
});

describe('toPublicCheckSettings', () => {
	it('reports HTTP auth without exposing the secret', async () => {
		await readyCrypto();
		const form = new FormData();
		form.set('checkType', 'http');
		form.set('checkUrl', 'https://api.example.com/health');
		form.set('httpAuthMode', 'header');
		form.set('httpAuthHeaderName', 'X-API-Key');
		form.set('httpAuthHeaderValue', 'super-secret-key');
		const parsed = parseCheckFieldsFromForm(form);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;

		const pub = toPublicCheckSettings('http', parsed.value.checkConfig);
		expect(pub).toEqual({
			type: 'http',
			auth: 'header',
			hasCredential: true,
			username: '',
			headerName: 'X-API-Key'
		});
		expect(JSON.stringify(pub)).not.toContain('super-secret-key');
	});

	it('reports no auth for an HTTP check with no stored config', () => {
		expect(toPublicCheckSettings('http', null)).toEqual({
			type: 'http',
			auth: 'none',
			hasCredential: false,
			username: '',
			headerName: ''
		});
	});

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
