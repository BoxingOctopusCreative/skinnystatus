import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { InfisicalSDK } from '@infisical/sdk';
import { BRAND_NAME } from '$lib/brand';

/**
 * Load `.env` into process.env when the runtime has not already done so.
 * Existing process.env values win over the `.env` file, except Infisical
 * machine-identity keys (`INFISICAL_*`): those always refresh from `.env` so
 * rotated Client ID/Secret in the file are not masked by a stale shell env.
 * After login, Infisical project secrets overwrite process.env.
 */
let dotenvLoaded = false;

const INFISICAL_ENV_KEYS = new Set([
	'INFISICAL_CLIENT_ID',
	'INFISICAL_CLIENT_SECRET',
	'INFISICAL_PROJECT_ID',
	'INFISICAL_ENVIRONMENT',
	'INFISICAL_SITE_URL'
]);

export function loadDotEnvFile(): void {
	if (dotenvLoaded) return;
	dotenvLoaded = true;

	const envPath = resolve(process.cwd(), '.env');
	if (!existsSync(envPath)) return;

	const text = readFileSync(envPath, 'utf8');
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;

		const key = trimmed.slice(0, eq).trim();
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		const forceFromFile = INFISICAL_ENV_KEYS.has(key);
		if (!forceFromFile && process.env[key] !== undefined) continue;
		process.env[key] = value;
	}
}

/** Test helper: allow `.env` to be applied again on the next initConfig(). */
export function resetDotEnvForTests(): void {
	dotenvLoaded = false;
}

export type ProviderConfig = {
	vercel: { token: string | null; teamId: string | null };
	cloudflare: { apiToken: string | null; accountId: string | null };
	netlify: { token: string | null };
	github: { token: string | null; owner: string | null };
	mailgun: {
		apiKey: string | null;
		domain: string | null;
		from: string | null;
		/** `us` (default) or `eu` */
		region: 'us' | 'eu';
	};
};

export type AppConfig = {
	site: {
		name: string;
		description: string;
		baseUrl: string;
	};
	database: {
		url: string;
	};
	publishing: {
		/** Apex / subdomain parent host (no scheme). */
		baseDomain: string;
		pathPrefix: string;
	};
	providers: ProviderConfig;
	checks: {
		intervalSeconds: number;
		timeoutMs: number;
		degradedLatencyMs: number;
	};
	auth: {
		secret: string;
		githubClientId: string | null;
		githubClientSecret: string | null;
		googleClientId: string | null;
		googleClientSecret: string | null;
	};
	r2: {
		accountId: string | null;
		accessKeyId: string | null;
		secretAccessKey: string | null;
		bucket: string | null;
		endpoint: string | null;
		region: string;
	};
	turnstile: {
		siteKey: string | null;
		secret: string | null;
	};
	stripe: {
		secretKey: string | null;
		webhookSecret: string | null;
		priceIds: {
			bronze: string | null;
			silver: string | null;
			gold: string | null;
			platinum: string | null;
		};
	};
};

const DEFAULTS: AppConfig = {
	site: {
		name: BRAND_NAME,
		description: 'Service status',
		baseUrl: 'http://localhost:5173'
	},
	database: {
		url: 'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus'
	},
	publishing: {
		baseDomain: 'localhost',
		pathPrefix: 's'
	},
	providers: {
		vercel: { token: null, teamId: null },
		cloudflare: { apiToken: null, accountId: null },
		netlify: { token: null },
		github: { token: null, owner: null },
		mailgun: { apiKey: null, domain: null, from: null, region: 'us' }
	},
	checks: {
		intervalSeconds: 60,
		timeoutMs: 5000,
		degradedLatencyMs: 2000
	},
	auth: {
		secret: 'change-me-in-production-use-a-long-random-string',
		githubClientId: null,
		githubClientSecret: null,
		googleClientId: null,
		googleClientSecret: null
	},
	r2: {
		accountId: null,
		accessKeyId: null,
		secretAccessKey: null,
		bucket: null,
		endpoint: null,
		region: 'auto'
	},
	turnstile: {
		siteKey: null,
		secret: null
	},
	stripe: {
		secretKey: null,
		webhookSecret: null,
		priceIds: {
			bronze: null,
			silver: null,
			gold: null,
			platinum: null
		}
	}
};

function env(key: string): string | undefined {
	const value = process.env[key];
	return value === undefined || value === '' ? undefined : value;
}

function firstEnv(...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = env(key);
		if (value !== undefined) return value;
	}
	return undefined;
}

/** Site origin only; ignores Vite's relative `BASE_URL` (e.g. `/`). */
function firstAbsoluteHttpUrl(...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = env(key);
		if (value !== undefined && /^https?:\/\//i.test(value)) return value;
	}
	return undefined;
}

function emptyToNull(value: string | undefined | null): string | null {
	if (value === undefined || value === null || value === '') return null;
	return value;
}

export function isPostgresUrl(url: string): boolean {
	return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

function requirePostgresUrl(url: string): string {
	if (!isPostgresUrl(url)) {
		throw new Error(
			`DATABASE_URL must be a Postgres URL (postgres:// or postgresql://). Got: ${url.slice(0, 32)}`
		);
	}
	return url;
}

function infisicalCredentialsPresent(): boolean {
	return Boolean(
		env('INFISICAL_CLIENT_ID') && env('INFISICAL_CLIENT_SECRET') && env('INFISICAL_PROJECT_ID')
	);
}

async function loadInfisicalSecrets(): Promise<void> {
	if (env('INFISICAL_DISABLE') === '1' || env('INFISICAL_DISABLE') === 'true') return;
	if (!infisicalCredentialsPresent()) return;

	const clientId = env('INFISICAL_CLIENT_ID')!;
	const clientSecret = env('INFISICAL_CLIENT_SECRET')!;
	const projectId = env('INFISICAL_PROJECT_ID')!;
	const environment = env('INFISICAL_ENVIRONMENT') ?? 'dev';
	const siteUrl = env('INFISICAL_SITE_URL');

	const client = new InfisicalSDK(siteUrl ? { siteUrl } : undefined);
	await client.auth().universalAuth.login({ clientId, clientSecret });

	await client.secrets().listSecrets({
		projectId,
		environment,
		expandSecretReferences: true,
		viewSecretValue: true,
		attachToProcessEnv: true
	});

	// Database URL lives at Infisical path /db/url (folder /db, secret key url)
	const dbSecret = await client.secrets().getSecret({
		projectId,
		environment,
		secretName: 'url',
		secretPath: '/db',
		expandSecretReferences: true,
		viewSecretValue: true
	});
	const dbUrl = dbSecret.secretValue?.trim();
	if (!dbUrl) {
		throw new Error('Infisical secret /db/url is empty');
	}
	process.env.DATABASE_URL = dbUrl;

	// Better Auth secret lives at Infisical path /app/auth_secret
	const authSecret = await client.secrets().getSecret({
		projectId,
		environment,
		secretName: 'auth_secret',
		secretPath: '/app',
		expandSecretReferences: true,
		viewSecretValue: true
	});
	const authSecretValue = authSecret.secretValue?.trim();
	if (!authSecretValue) {
		throw new Error('Infisical secret /app/auth_secret is empty');
	}
	process.env.AUTH_SECRET = authSecretValue;

	// Mailgun settings live under Infisical path /mailgun
	await loadMailgunFromInfisical(client, projectId, environment);

	// GitHub OAuth (user sign-in / sign-up) under Infisical path /oauth/github
	await loadGithubOAuthFromInfisical(client, projectId, environment);

	// Google OAuth (user sign-in / sign-up) under Infisical path /oauth/google
	await loadGoogleOAuthFromInfisical(client, projectId, environment);

	// Cloudflare R2 under Infisical path /r2
	await loadR2FromInfisical(client, projectId, environment);

	// Cloudflare Turnstile under Infisical path /turnstile
	await loadTurnstileFromInfisical(client, projectId, environment);

	// Stripe under Infisical path /stripe
	await loadStripeFromInfisical(client, projectId, environment);

	// Sentry under Infisical path /sentry
	await loadSentryFromInfisical(client, projectId, environment);
}

const MAILGUN_SECRET_ENV: Record<string, string> = {
	api_key: 'MAILGUN_API_KEY',
	MAILGUN_API_KEY: 'MAILGUN_API_KEY',
	domain: 'MAILGUN_DOMAIN',
	MAILGUN_DOMAIN: 'MAILGUN_DOMAIN',
	from: 'MAILGUN_FROM',
	MAILGUN_FROM: 'MAILGUN_FROM',
	region: 'MAILGUN_REGION',
	MAILGUN_REGION: 'MAILGUN_REGION'
};

async function loadMailgunFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	const listed = await client.secrets().listSecrets({
		projectId,
		environment,
		secretPath: '/mailgun',
		expandSecretReferences: true,
		viewSecretValue: true
	});

	for (const secret of listed.secrets ?? []) {
		const envKey = MAILGUN_SECRET_ENV[secret.secretKey];
		if (!envKey) continue;
		const value = secret.secretValue?.trim();
		if (value) process.env[envKey] = value;
	}
}

const GITHUB_OAUTH_SECRET_ENV: Record<string, string> = {
	client_id: 'GITHUB_CLIENT_ID',
	GITHUB_CLIENT_ID: 'GITHUB_CLIENT_ID',
	client_secret: 'GITHUB_CLIENT_SECRET',
	GITHUB_CLIENT_SECRET: 'GITHUB_CLIENT_SECRET'
};

async function loadGithubOAuthFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/oauth/github',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = GITHUB_OAUTH_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (value) process.env[envKey] = value;
		}
	} catch {
		// Optional: folder may not exist until GitHub OAuth is configured
	}
}

const GOOGLE_OAUTH_SECRET_ENV: Record<string, string> = {
	client_id: 'GOOGLE_CLIENT_ID',
	GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
	client_secret: 'GOOGLE_CLIENT_SECRET',
	GOOGLE_CLIENT_SECRET: 'GOOGLE_CLIENT_SECRET'
};

async function loadGoogleOAuthFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/oauth/google',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = GOOGLE_OAUTH_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (value) process.env[envKey] = value;
		}
	} catch {
		// Optional: folder may not exist until Google OAuth is configured
	}
}

const R2_SECRET_ENV: Record<string, string> = {
	account_id: 'R2_ACCOUNT_ID',
	ACCOUNT_ID: 'R2_ACCOUNT_ID',
	R2_ACCOUNT_ID: 'R2_ACCOUNT_ID',
	access_key_id: 'R2_ACCESS_KEY_ID',
	ACCESS_KEY_ID: 'R2_ACCESS_KEY_ID',
	R2_ACCESS_KEY_ID: 'R2_ACCESS_KEY_ID',
	secret_access_key: 'R2_SECRET_ACCESS_KEY',
	SECRET_ACCESS_KEY: 'R2_SECRET_ACCESS_KEY',
	R2_SECRET_ACCESS_KEY: 'R2_SECRET_ACCESS_KEY',
	bucket: 'R2_BUCKET',
	BUCKET: 'R2_BUCKET',
	R2_BUCKET: 'R2_BUCKET',
	endpoint: 'R2_ENDPOINT',
	ENDPOINT: 'R2_ENDPOINT',
	R2_ENDPOINT: 'R2_ENDPOINT',
	region: 'R2_REGION',
	REGION: 'R2_REGION',
	R2_REGION: 'R2_REGION'
};

async function loadR2FromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/r2',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = R2_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (value) process.env[envKey] = value;
		}
	} catch {
		// Optional: folder may not exist until R2 is configured
	}
}

const TURNSTILE_SECRET_ENV: Record<string, string> = {
	site_key: 'TURNSTILE_SITE_KEY',
	SITE_KEY: 'TURNSTILE_SITE_KEY',
	TURNSTILE_SITE_KEY: 'TURNSTILE_SITE_KEY',
	secret: 'TURNSTILE_SECRET',
	SECRET: 'TURNSTILE_SECRET',
	TURNSTILE_SECRET: 'TURNSTILE_SECRET'
};

async function loadTurnstileFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/turnstile',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = TURNSTILE_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (value) process.env[envKey] = value;
		}
	} catch {
		// Optional: folder may not exist until Turnstile is configured
	}
}

const STRIPE_SECRET_ENV: Record<string, string> = {
	secret_key: 'STRIPE_SECRET_KEY',
	SECRET_KEY: 'STRIPE_SECRET_KEY',
	STRIPE_SECRET_KEY: 'STRIPE_SECRET_KEY',
	webhook_secret: 'STRIPE_WEBHOOK_SECRET',
	WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
	STRIPE_WEBHOOK_SECRET: 'STRIPE_WEBHOOK_SECRET',
	price_bronze: 'STRIPE_PRICE_BRONZE',
	PRICE_BRONZE: 'STRIPE_PRICE_BRONZE',
	STRIPE_PRICE_BRONZE: 'STRIPE_PRICE_BRONZE',
	price_silver: 'STRIPE_PRICE_SILVER',
	PRICE_SILVER: 'STRIPE_PRICE_SILVER',
	STRIPE_PRICE_SILVER: 'STRIPE_PRICE_SILVER',
	price_gold: 'STRIPE_PRICE_GOLD',
	PRICE_GOLD: 'STRIPE_PRICE_GOLD',
	STRIPE_PRICE_GOLD: 'STRIPE_PRICE_GOLD',
	price_platinum: 'STRIPE_PRICE_PLATINUM',
	PRICE_PLATINUM: 'STRIPE_PRICE_PLATINUM',
	STRIPE_PRICE_PLATINUM: 'STRIPE_PRICE_PLATINUM'
};

async function loadStripeFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/stripe',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = STRIPE_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (value) process.env[envKey] = value;
		}
	} catch {
		// Optional: folder may not exist until Stripe is configured
	}
}

/** Maps Infisical /sentry keys to process.env (DSN also mirrored to PUBLIC_ for the client). */
const SENTRY_SECRET_ENV: Record<string, string> = {
	dsn: 'SENTRY_DSN',
	DSN: 'SENTRY_DSN',
	SENTRY_DSN: 'SENTRY_DSN',
	environment: 'SENTRY_ENVIRONMENT',
	ENVIRONMENT: 'SENTRY_ENVIRONMENT',
	SENTRY_ENVIRONMENT: 'SENTRY_ENVIRONMENT',
	release: 'SENTRY_RELEASE',
	RELEASE: 'SENTRY_RELEASE',
	SENTRY_RELEASE: 'SENTRY_RELEASE',
	org: 'SENTRY_ORG',
	ORG: 'SENTRY_ORG',
	SENTRY_ORG: 'SENTRY_ORG',
	project: 'SENTRY_PROJECT',
	PROJECT: 'SENTRY_PROJECT',
	SENTRY_PROJECT: 'SENTRY_PROJECT',
	auth_token: 'SENTRY_AUTH_TOKEN',
	AUTH_TOKEN: 'SENTRY_AUTH_TOKEN',
	SENTRY_AUTH_TOKEN: 'SENTRY_AUTH_TOKEN'
};

const SENTRY_PUBLIC_MIRROR: Record<string, string> = {
	SENTRY_DSN: 'PUBLIC_SENTRY_DSN',
	SENTRY_ENVIRONMENT: 'PUBLIC_SENTRY_ENVIRONMENT',
	SENTRY_RELEASE: 'PUBLIC_SENTRY_RELEASE'
};

async function loadSentryFromInfisical(
	client: InfisicalSDK,
	projectId: string,
	environment: string
): Promise<void> {
	try {
		const listed = await client.secrets().listSecrets({
			projectId,
			environment,
			secretPath: '/sentry',
			expandSecretReferences: true,
			viewSecretValue: true
		});

		for (const secret of listed.secrets ?? []) {
			const envKey = SENTRY_SECRET_ENV[secret.secretKey];
			if (!envKey) continue;
			const value = secret.secretValue?.trim();
			if (!value) continue;
			process.env[envKey] = value;
			const publicKey = SENTRY_PUBLIC_MIRROR[envKey];
			if (publicKey) process.env[publicKey] = value;
		}
	} catch {
		// Optional: folder may not exist until Sentry is configured
	}
}

function buildConfig(): AppConfig {
	const baseDomainRaw =
		firstEnv('PUBLISHING_BASE_DOMAIN', 'PUBLISHING_APEX_DOMAIN') ?? DEFAULTS.publishing.baseDomain;

	const databaseUrl = requirePostgresUrl(
		firstEnv('DATABASE_URL') ?? DEFAULTS.database.url
	);

	return {
		site: {
			name: BRAND_NAME,
			description: firstEnv('SITE_DESCRIPTION') ?? DEFAULTS.site.description,
			baseUrl:
				firstAbsoluteHttpUrl('ORIGIN', 'BASE_URL', 'SITE_BASE_URL') ?? DEFAULTS.site.baseUrl
		},
		database: {
			url: databaseUrl
		},
		publishing: {
			baseDomain: baseDomainRaw
				.replace(/^https?:\/\//, '')
				.replace(/\/$/, '')
				.toLowerCase(),
			pathPrefix: (firstEnv('PUBLISHING_PATH_PREFIX') ?? DEFAULTS.publishing.pathPrefix).replace(
				/^\/+|\/+$/g,
				''
			)
		},
		providers: {
			vercel: {
				token: emptyToNull(firstEnv('VERCEL_TOKEN')),
				teamId: emptyToNull(firstEnv('VERCEL_TEAM_ID'))
			},
			cloudflare: {
				apiToken: emptyToNull(firstEnv('CLOUDFLARE_API_TOKEN')),
				accountId: emptyToNull(firstEnv('CLOUDFLARE_ACCOUNT_ID'))
			},
			netlify: {
				token: emptyToNull(firstEnv('NETLIFY_TOKEN'))
			},
			github: {
				token: emptyToNull(firstEnv('GITHUB_TOKEN', 'GH_TOKEN')),
				owner: emptyToNull(firstEnv('GITHUB_OWNER'))
			},
			mailgun: {
				apiKey: emptyToNull(firstEnv('MAILGUN_API_KEY')),
				domain: emptyToNull(firstEnv('MAILGUN_DOMAIN')),
				from: emptyToNull(firstEnv('MAILGUN_FROM')),
				region: ((): 'us' | 'eu' => {
					const raw = (firstEnv('MAILGUN_REGION') ?? 'us').toLowerCase();
					return raw === 'eu' ? 'eu' : 'us';
				})()
			}
		},
		checks: {
			intervalSeconds: Number(
				firstEnv('CHECKS_INTERVAL_SECONDS') ?? DEFAULTS.checks.intervalSeconds
			),
			timeoutMs: Number(firstEnv('CHECKS_TIMEOUT_MS') ?? DEFAULTS.checks.timeoutMs),
			degradedLatencyMs: Number(
				firstEnv('CHECKS_DEGRADED_LATENCY_MS') ?? DEFAULTS.checks.degradedLatencyMs
			)
		},
		auth: {
			secret: firstEnv('AUTH_SECRET', 'BETTER_AUTH_SECRET') ?? DEFAULTS.auth.secret,
			githubClientId: emptyToNull(firstEnv('GITHUB_CLIENT_ID')),
			githubClientSecret: emptyToNull(firstEnv('GITHUB_CLIENT_SECRET')),
			googleClientId: emptyToNull(firstEnv('GOOGLE_CLIENT_ID')),
			googleClientSecret: emptyToNull(firstEnv('GOOGLE_CLIENT_SECRET'))
		},
		r2: {
			accountId: emptyToNull(firstEnv('R2_ACCOUNT_ID')),
			accessKeyId: emptyToNull(firstEnv('R2_ACCESS_KEY_ID')),
			secretAccessKey: emptyToNull(firstEnv('R2_SECRET_ACCESS_KEY')),
			bucket: emptyToNull(firstEnv('R2_BUCKET')),
			endpoint: emptyToNull(firstEnv('R2_ENDPOINT')),
			region: firstEnv('R2_REGION') ?? DEFAULTS.r2.region
		},
		turnstile: {
			siteKey: emptyToNull(firstEnv('TURNSTILE_SITE_KEY')),
			secret: emptyToNull(firstEnv('TURNSTILE_SECRET'))
		},
		stripe: {
			secretKey: emptyToNull(firstEnv('STRIPE_SECRET_KEY')),
			webhookSecret: emptyToNull(firstEnv('STRIPE_WEBHOOK_SECRET')),
			priceIds: {
				bronze: emptyToNull(firstEnv('STRIPE_PRICE_BRONZE')),
				silver: emptyToNull(firstEnv('STRIPE_PRICE_SILVER')),
				gold: emptyToNull(firstEnv('STRIPE_PRICE_GOLD')),
				platinum: emptyToNull(firstEnv('STRIPE_PRICE_PLATINUM'))
			}
		}
	};
}

let cached: AppConfig | null = null;
let initPromise: Promise<AppConfig> | null = null;

/**
 * Load `.env`, optionally Infisical secrets, then build and cache AppConfig.
 * Safe to call multiple times; concurrent callers share one promise.
 */
export async function initConfig(): Promise<AppConfig> {
	if (cached) return cached;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		loadDotEnvFile();
		await loadInfisicalSecrets();
		cached = buildConfig();
		return cached;
	})();

	try {
		return await initPromise;
	} catch (err) {
		initPromise = null;
		throw err;
	}
}

export function getConfig(): AppConfig {
	if (!cached) {
		throw new Error('Config not initialized. Call await initConfig() before getConfig().');
	}
	return cached;
}

export function resetConfigCache(): void {
	cached = null;
	initPromise = null;
}
