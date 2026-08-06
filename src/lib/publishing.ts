import type { HostProvider, PageTheme } from '$lib/theme-config';
import { isHostProvider, parsePageTheme } from '$lib/theme-config';

export const PUBLISH_MODES = ['path', 'subdomain'] as const;
export type PublishMode = (typeof PUBLISH_MODES)[number];

export type StatusPageInfo = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	publishMode: PublishMode;
	hostProvider: HostProvider;
	teamId: string;
	theme: PageTheme;
	deployUrl: string | null;
	deployProviderId: string | null;
	lastDeployedAt: Date | null;
	lastDeployError: string | null;
	published: boolean;
	deletedAt: Date | null;
};

export function isPublishMode(value: string): value is PublishMode {
	return (PUBLISH_MODES as readonly string[]).includes(value);
}

export function isValidSlug(slug: string): boolean {
	// No consecutive hyphens: Vercel project names reject `---` and DNS labels dislike runs of `-`.
	return (
		/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !slug.includes('--')
	);
}

/** Platform-fixed path prefix for admin preview routes (`/s/{slug}`). */
export const PLATFORM_PATH_PREFIX = 's';

/** Team path prefix for static-host nesting and URL hints. */
export function isValidPublishPathPrefix(value: string): boolean {
	return /^[a-z0-9]([a-z0-9-]{0,31}[a-z0-9])?$/.test(value) && !value.includes('--');
}

/**
 * Hostname only (no scheme, port, path). Empty string is allowed (means unset).
 * Examples: `status.acme.com`, `localhost`
 */
export function normalizePublishBaseDomain(raw: string): string | null {
	const trimmed = raw.trim().toLowerCase();
	if (!trimmed) return null;
	const withoutScheme = trimmed.replace(/^https?:\/\//, '');
	const host = withoutScheme.split('/')[0]?.split(':')[0] ?? '';
	if (!host) return null;
	if (!/^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) || host.includes('..')) {
		throw new Error('Base domain must be a hostname (no scheme, port, or path)');
	}
	return host;
}

export function normalizePublishPathPrefix(raw: string): string {
	const value = raw.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
	if (!isValidPublishPathPrefix(value)) {
		throw new Error(
			'Path prefix must be lowercase alphanumeric with optional hyphens (1–33 chars)'
		);
	}
	return value;
}

/** Client-safe URL hint from publish mode + host provider (no server config). */
export function formatPublishUrlHint(opts: {
	slug: string;
	publishMode: PublishMode | string;
	hostProvider: HostProvider | string;
	pathPrefix: string;
	apexDomain: string;
}): string {
	const slug = opts.slug.trim() || '<slug>';
	const prefix = opts.pathPrefix.replace(/^\/+|\/+$/g, '') || 's';
	if (opts.publishMode === 'subdomain') {
		const apex = opts.apexDomain.trim() || '<base-domain>';
		return `https://${slug}.${apex}`;
	}
	switch (opts.hostProvider) {
		case 'cloudflare_pages':
			return `https://<project>.pages.dev/${prefix}/${slug}`;
		case 'netlify':
			return `https://<site>.netlify.app/${prefix}/${slug}`;
		case 'github_pages':
			return `https://<owner>.github.io/<repo>/${prefix}/${slug}`;
		case 'static_app':
			return `https://<site>.static.app/${prefix}/${slug}`;
		case 'amazon_s3':
			return `https://<public-base-url>/${prefix}/${slug}`;
		case 'firebase_hosting':
			return `https://<site-id>.web.app/${prefix}/${slug}`;
		case 'azure_static_web_apps':
			return `https://<app>.azurestaticapps.net/${prefix}/${slug}`;
		case 'vercel':
		default:
			return `https://<project>.vercel.app/${prefix}/${slug}`;
	}
}

export { isHostProvider, HOST_PROVIDERS } from '$lib/theme-config';
export type { HostProvider, PageTheme } from '$lib/theme-config';

export function pageInfoFromRow(row: {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	publishMode: string;
	hostProvider?: string | null;
	teamId?: string | null;
	themeJson?: string | null;
	deployUrl?: string | null;
	deployProviderId?: string | null;
	lastDeployedAt?: Date | null;
	lastDeployError?: string | null;
	published?: boolean | null;
	deletedAt?: Date | null;
}): StatusPageInfo {
	const mode = isPublishMode(row.publishMode) ? row.publishMode : 'path';
	const provider =
		row.hostProvider && isHostProvider(row.hostProvider) ? row.hostProvider : 'vercel';
	return {
		id: row.id,
		slug: row.slug,
		name: row.name,
		description: row.description,
		publishMode: mode,
		hostProvider: provider,
		teamId: row.teamId ?? '',
		theme: parsePageTheme(row.themeJson),
		deployUrl: row.deployUrl ?? null,
		deployProviderId: row.deployProviderId ?? null,
		lastDeployedAt: row.lastDeployedAt ?? null,
		lastDeployError: row.lastDeployError ?? null,
		published: row.published !== false,
		deletedAt: row.deletedAt ?? null
	};
}
