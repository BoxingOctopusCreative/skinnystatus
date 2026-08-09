/** Shared check-type constants (safe for client + server). */

export const CHECK_TYPES = ['http', 'tcp', 'dns', 'ssl', 'postgres', 'mysql', 'redis'] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export const HTTP_AUTH_MODES = ['none', 'bearer', 'basic', 'header'] as const;
export type HttpAuthMode = (typeof HTTP_AUTH_MODES)[number];

export function isCheckType(value: string): value is CheckType {
	return (CHECK_TYPES as readonly string[]).includes(value);
}

export function isHttpAuthMode(value: string): value is HttpAuthMode {
	return (HTTP_AUTH_MODES as readonly string[]).includes(value);
}

export function httpAuthModeLabel(mode: HttpAuthMode): string {
	switch (mode) {
		case 'none':
			return 'None';
		case 'bearer':
			return 'Bearer token';
		case 'basic':
			return 'Basic auth';
		case 'header':
			return 'Custom header';
	}
}

/** Header names are RFC 7230 tokens. Anything else can forge a request. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function isValidHeaderName(value: string): boolean {
	return HEADER_NAME_PATTERN.test(value);
}

/** Reject control characters so a value can't inject extra headers. */
export function isValidHeaderValue(value: string): boolean {
	return !/[\r\n\0]/.test(value);
}

export function checkTypeLabel(type: CheckType): string {
	switch (type) {
		case 'http':
			return 'HTTP';
		case 'tcp':
			return 'TCP';
		case 'dns':
			return 'DNS';
		case 'ssl':
			return 'SSL';
		case 'postgres':
			return 'Postgres';
		case 'mysql':
			return 'MySQL';
		case 'redis':
			return 'Redis / Valkey';
	}
}

/**
 * Short description of what the probe connects to, for the check detail panel.
 * Never show this to visitors unless the project opted into technical detail:
 * database and TCP targets are internal hosts.
 */
export function describeCheckTarget(
	settings: PublicCheckSettings | null,
	checkUrl: string | null
): string | null {
	if (!settings) return checkUrl;
	switch (settings.type) {
		case 'http':
			return checkUrl;
		case 'dns':
			return `${settings.recordType} ${settings.hostname}`;
		case 'postgres':
		case 'mysql':
			return settings.database
				? `${settings.host}:${settings.port}/${settings.database}`
				: `${settings.host}:${settings.port}`;
		default:
			return `${settings.host}:${settings.port}`;
	}
}

/** Optional credentials for HTTP checks. Stored encrypted in `check_config`. */
export type HttpCheckConfig = {
	auth: HttpAuthMode;
	/** Bearer mode. */
	token?: string;
	/** Basic mode. */
	username?: string;
	password?: string;
	/** Custom header mode. */
	headerName?: string;
	headerValue?: string;
};

export type TcpCheckConfig = { host: string; port: number };
export type DnsCheckConfig = {
	hostname: string;
	recordType: DnsRecordType;
	expected?: string[];
};
export type SslCheckConfig = {
	host: string;
	port: number;
	minDaysRemaining: number;
};
export type DbCheckConfig = {
	host: string;
	port: number;
	authenticated: boolean;
	database?: string;
	user?: string;
	password?: string;
	ssl?: boolean;
};
export type RedisCheckConfig = {
	host: string;
	port: number;
	authenticated: boolean;
	username?: string;
	password?: string;
};

export type StoredCheckConfig =
	| HttpCheckConfig
	| TcpCheckConfig
	| DnsCheckConfig
	| SslCheckConfig
	| DbCheckConfig
	| RedisCheckConfig;

/** Config fields safe to send to the browser (no secrets). */
export type PublicCheckSettings =
	| {
			type: 'http';
			auth: HttpAuthMode;
			/** True when a token, password, or header value is stored. */
			hasCredential: boolean;
			username: string;
			headerName: string;
	  }
	| { type: 'tcp'; host: string; port: number }
	| {
			type: 'dns';
			hostname: string;
			recordType: DnsRecordType;
			expected: string;
	  }
	| { type: 'ssl'; host: string; port: number; minDaysRemaining: number }
	| {
			type: 'postgres' | 'mysql';
			host: string;
			port: number;
			authenticated: boolean;
			database: string;
			user: string;
			ssl: boolean;
			hasPassword: boolean;
	  }
	| {
			type: 'redis';
			host: string;
			port: number;
			authenticated: boolean;
			username: string;
			hasPassword: boolean;
	  };
