import {
	DNS_RECORD_TYPES,
	isCheckType,
	isHttpAuthMode,
	isValidHeaderName,
	isValidHeaderValue,
	type CheckType,
	type DbCheckConfig,
	type DnsCheckConfig,
	type DnsRecordType,
	type HttpCheckConfig,
	type PublicCheckSettings,
	type RedisCheckConfig,
	type SslCheckConfig,
	type StoredCheckConfig,
	type TcpCheckConfig
} from '$lib/checks';
import { decryptJson, encryptJson } from '$lib/server/crypto';

export type ParsedServiceCheck = {
	checkType: CheckType | null;
	checkUrl: string | null;
	expectedStatus: number;
	checkConfig: string | null;
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const s = value?.toString().trim() ?? '';
	return s === '' ? null : s;
}

function parsePort(value: FormDataEntryValue | null, fallback: number): number | null {
	const raw = value?.toString().trim() ?? '';
	if (raw === '') return fallback;
	const n = Number(raw);
	if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
	return n;
}

function parseHost(value: FormDataEntryValue | null): string | null {
	const host = emptyToNull(value);
	if (!host) return null;
	if (/\s/.test(host)) return null;
	return host;
}

function boolFromForm(value: FormDataEntryValue | null): boolean {
	const s = value?.toString().toLowerCase() ?? '';
	return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function parseExpectedList(value: FormDataEntryValue | null): string[] | undefined {
	const raw = emptyToNull(value);
	if (!raw) return undefined;
	const list = raw
		.split(/[\n,]/)
		.map((s) => s.trim())
		.filter(Boolean);
	return list.length > 0 ? list : undefined;
}

function isDnsRecordType(value: string): value is DnsRecordType {
	return (DNS_RECORD_TYPES as readonly string[]).includes(value);
}

export function decryptCheckConfig<T extends StoredCheckConfig>(
	ciphertext: string | null
): T | null {
	if (!ciphertext) return null;
	return decryptJson<T>(ciphertext);
}

export function toPublicCheckSettings(
	checkType: string | null,
	checkConfig: string | null
): PublicCheckSettings | null {
	if (!checkType || !isCheckType(checkType)) return null;

	const noHttpAuth: PublicCheckSettings = {
		type: 'http',
		auth: 'none',
		hasCredential: false,
		username: '',
		headerName: ''
	};

	try {
		const cfg = decryptCheckConfig(checkConfig);
		if (!cfg) return checkType === 'http' ? noHttpAuth : null;

		switch (checkType) {
			case 'http': {
				const c = cfg as HttpCheckConfig;
				if (!isHttpAuthMode(c.auth ?? '')) return noHttpAuth;
				return {
					type: 'http',
					auth: c.auth,
					hasCredential: Boolean(c.token || c.password || c.headerValue),
					username: c.username ?? '',
					headerName: c.headerName ?? ''
				};
			}
			case 'tcp': {
				const c = cfg as TcpCheckConfig;
				return { type: 'tcp', host: c.host, port: c.port };
			}
			case 'dns': {
				const c = cfg as DnsCheckConfig;
				return {
					type: 'dns',
					hostname: c.hostname,
					recordType: c.recordType,
					expected: (c.expected ?? []).join(', ')
				};
			}
			case 'ssl': {
				const c = cfg as SslCheckConfig;
				return {
					type: 'ssl',
					host: c.host,
					port: c.port,
					minDaysRemaining: c.minDaysRemaining
				};
			}
			case 'postgres':
			case 'mysql': {
				const c = cfg as DbCheckConfig;
				return {
					type: checkType,
					host: c.host,
					port: c.port,
					authenticated: c.authenticated,
					database: c.database ?? '',
					user: c.user ?? '',
					ssl: Boolean(c.ssl),
					hasPassword: Boolean(c.password)
				};
			}
			case 'redis': {
				const c = cfg as RedisCheckConfig;
				return {
					type: 'redis',
					host: c.host,
					port: c.port,
					authenticated: c.authenticated,
					username: c.username ?? '',
					hasPassword: Boolean(c.password)
				};
			}
		}
	} catch {
		return checkType === 'http' ? noHttpAuth : null;
	}
}

/**
 * Credentials for an HTTP check. Secrets left blank in the form keep whatever is
 * already stored, so an operator can edit a URL without retyping a token. The
 * previous config only carries over when the service was already an HTTP check,
 * so a database password can never become a bearer token.
 */
function parseHttpAuthConfig(
	form: FormData,
	existing?: { checkType: string | null; checkConfig: string | null }
): { ok: true; value: HttpCheckConfig | null } | { ok: false; message: string } {
	const modeRaw = emptyToNull(form.get('httpAuthMode')) ?? 'none';
	if (!isHttpAuthMode(modeRaw)) {
		return { ok: false, message: 'Invalid HTTP authentication method' };
	}
	if (modeRaw === 'none') return { ok: true, value: null };

	const prev =
		existing?.checkType === 'http'
			? decryptCheckConfig<HttpCheckConfig>(existing.checkConfig)
			: null;
	const carryOver = prev?.auth === modeRaw ? prev : null;

	if (modeRaw === 'bearer') {
		const token = emptyToNull(form.get('httpAuthToken')) ?? carryOver?.token;
		if (!token) return { ok: false, message: 'A token is required for bearer authentication' };
		if (!isValidHeaderValue(token)) {
			return { ok: false, message: 'Token cannot contain line breaks' };
		}
		return { ok: true, value: { auth: 'bearer', token } };
	}

	if (modeRaw === 'basic') {
		const username = emptyToNull(form.get('httpAuthUsername'));
		if (!username) return { ok: false, message: 'A username is required for basic authentication' };
		if (username.includes(':')) {
			return { ok: false, message: 'Basic auth usernames cannot contain a colon' };
		}
		const password = emptyToNull(form.get('httpAuthPassword')) ?? carryOver?.password;
		if (!password) return { ok: false, message: 'A password is required for basic authentication' };
		if (!isValidHeaderValue(username) || !isValidHeaderValue(password)) {
			return { ok: false, message: 'Credentials cannot contain line breaks' };
		}
		return { ok: true, value: { auth: 'basic', username, password } };
	}

	const headerName = emptyToNull(form.get('httpAuthHeaderName'));
	if (!headerName) return { ok: false, message: 'A header name is required' };
	if (!isValidHeaderName(headerName)) {
		return {
			ok: false,
			message: "Header name can only contain letters, digits, and the characters !#$%&'*+-.^_`|~"
		};
	}
	const headerValue = emptyToNull(form.get('httpAuthHeaderValue')) ?? carryOver?.headerValue;
	if (!headerValue) return { ok: false, message: 'A header value is required' };
	if (!isValidHeaderValue(headerValue)) {
		return { ok: false, message: 'Header value cannot contain line breaks' };
	}
	return { ok: true, value: { auth: 'header', headerName, headerValue } };
}

export function parseCheckFieldsFromForm(
	form: FormData,
	existing?: { checkType: string | null; checkConfig: string | null }
): { ok: true; value: ParsedServiceCheck } | { ok: false; message: string } {
	const typeRaw = emptyToNull(form.get('checkType'));
	if (!typeRaw) {
		return {
			ok: true,
			value: {
				checkType: null,
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: null
			}
		};
	}
	if (!isCheckType(typeRaw)) {
		return { ok: false, message: 'Invalid check type' };
	}

	if (typeRaw === 'http') {
		const checkUrl = emptyToNull(form.get('checkUrl'));
		if (!checkUrl) {
			return { ok: false, message: 'Check URL is required for HTTP checks' };
		}
		const auth = parseHttpAuthConfig(form, existing);
		if (!auth.ok) return { ok: false, message: auth.message };
		return {
			ok: true,
			value: {
				checkType: 'http',
				checkUrl,
				expectedStatus: Number(form.get('expectedStatus') ?? 200) || 200,
				checkConfig: auth.value ? encryptJson(auth.value) : null
			}
		};
	}

	const existingCfg = decryptCheckConfig(existing?.checkConfig ?? null);

	if (typeRaw === 'tcp') {
		const host = parseHost(form.get('host'));
		const port = parsePort(form.get('port'), 80);
		if (!host || port === null) {
			return { ok: false, message: 'TCP checks require a valid host and port' };
		}
		const cfg: TcpCheckConfig = { host, port };
		return {
			ok: true,
			value: {
				checkType: 'tcp',
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: encryptJson(cfg)
			}
		};
	}

	if (typeRaw === 'dns') {
		const hostname = parseHost(form.get('hostname'));
		const recordRaw = emptyToNull(form.get('recordType')) ?? 'A';
		if (!hostname) {
			return { ok: false, message: 'DNS checks require a hostname' };
		}
		if (!isDnsRecordType(recordRaw)) {
			return { ok: false, message: 'Invalid DNS record type' };
		}
		const cfg: DnsCheckConfig = {
			hostname,
			recordType: recordRaw,
			expected: parseExpectedList(form.get('expected'))
		};
		return {
			ok: true,
			value: {
				checkType: 'dns',
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: encryptJson(cfg)
			}
		};
	}

	if (typeRaw === 'ssl') {
		const host = parseHost(form.get('host'));
		const port = parsePort(form.get('port'), 443);
		const minRaw = form.get('minDaysRemaining')?.toString().trim() ?? '';
		const minDaysRemaining = minRaw === '' ? 14 : Number(minRaw);
		if (!host || port === null) {
			return { ok: false, message: 'SSL checks require a valid host and port' };
		}
		if (!Number.isInteger(minDaysRemaining) || minDaysRemaining < 0) {
			return { ok: false, message: 'Min days remaining must be a non-negative integer' };
		}
		const cfg: SslCheckConfig = { host, port, minDaysRemaining };
		return {
			ok: true,
			value: {
				checkType: 'ssl',
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: encryptJson(cfg)
			}
		};
	}

	if (typeRaw === 'postgres' || typeRaw === 'mysql') {
		const defaultPort = typeRaw === 'postgres' ? 5432 : 3306;
		const host = parseHost(form.get('host'));
		const port = parsePort(form.get('port'), defaultPort);
		const authenticated = boolFromForm(form.get('authenticated'));
		if (!host || port === null) {
			return { ok: false, message: `${typeRaw} checks require a valid host and port` };
		}
		const prev = existingCfg as DbCheckConfig | null;
		const passwordInput = emptyToNull(form.get('password'));
		const password = passwordInput ?? (authenticated ? prev?.password : undefined);
		if (authenticated && !password) {
			return { ok: false, message: 'Password is required for authenticated checks' };
		}
		const user = emptyToNull(form.get('user')) ?? undefined;
		if (authenticated && !user) {
			return { ok: false, message: 'User is required for authenticated checks' };
		}
		const cfg: DbCheckConfig = {
			host,
			port,
			authenticated,
			database: emptyToNull(form.get('database')) ?? undefined,
			user,
			password: authenticated ? password : undefined,
			ssl: boolFromForm(form.get('ssl'))
		};
		return {
			ok: true,
			value: {
				checkType: typeRaw,
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: encryptJson(cfg)
			}
		};
	}

	if (typeRaw === 'redis') {
		const host = parseHost(form.get('host'));
		const port = parsePort(form.get('port'), 6379);
		const authenticated = boolFromForm(form.get('authenticated'));
		if (!host || port === null) {
			return { ok: false, message: 'Redis checks require a valid host and port' };
		}
		const prev = existingCfg as RedisCheckConfig | null;
		const passwordInput = emptyToNull(form.get('password'));
		const password = passwordInput ?? (authenticated ? prev?.password : undefined);
		if (authenticated && !password) {
			return { ok: false, message: 'Password is required for authenticated Redis checks' };
		}
		const cfg: RedisCheckConfig = {
			host,
			port,
			authenticated,
			username: emptyToNull(form.get('username')) ?? undefined,
			password: authenticated ? password : undefined
		};
		return {
			ok: true,
			value: {
				checkType: 'redis',
				checkUrl: null,
				expectedStatus: 200,
				checkConfig: encryptJson(cfg)
			}
		};
	}

	return { ok: false, message: 'Unsupported check type' };
}

/** Days remaining until cert expiry (fractional). */
export function sslDaysRemaining(notAfter: Date, now = new Date()): number {
	return (notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}
