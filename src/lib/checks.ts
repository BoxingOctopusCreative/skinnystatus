/** Shared check-type constants (safe for client + server). */

export const CHECK_TYPES = [
	'http',
	'tcp',
	'dns',
	'ssl',
	'postgres',
	'mysql',
	'redis'
] as const;

export type CheckType = (typeof CHECK_TYPES)[number];

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export function isCheckType(value: string): value is CheckType {
	return (CHECK_TYPES as readonly string[]).includes(value);
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
	| TcpCheckConfig
	| DnsCheckConfig
	| SslCheckConfig
	| DbCheckConfig
	| RedisCheckConfig;

/** Config fields safe to send to the browser (no secrets). */
export type PublicCheckSettings =
	| { type: 'http' }
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
