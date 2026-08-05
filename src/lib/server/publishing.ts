import { getConfig } from '$lib/server/config';
import { formatPublishUrlHint, type PublishMode, type StatusPageInfo } from '$lib/publishing';

export function apexHost(): string {
	const config = getConfig();
	try {
		return new URL(config.site.baseUrl).host.toLowerCase();
	} catch {
		return config.publishing.baseDomain.toLowerCase();
	}
}

export function stripPort(host: string): string {
	return host.replace(/:\d+$/, '').toLowerCase();
}

export function canonicalPageUrl(page: Pick<StatusPageInfo, 'slug' | 'publishMode' | 'deployUrl'>): string {
	if (page.deployUrl) return page.deployUrl;
	const config = getConfig();
	if (page.publishMode === 'subdomain') {
		const proto = config.site.baseUrl.startsWith('https') ? 'https' : 'http';
		return `${proto}://${page.slug}.${config.publishing.baseDomain}`;
	}
	const base = config.site.baseUrl.replace(/\/$/, '');
	return `${base}/${config.publishing.pathPrefix}/${page.slug}`;
}

/** Expected static publish URL hints (before first deploy). */
export function publishUrlHint(
	page: Pick<StatusPageInfo, 'slug' | 'publishMode' | 'hostProvider'>
): string {
	const config = getConfig();
	return formatPublishUrlHint({
		slug: page.slug,
		publishMode: page.publishMode,
		hostProvider: page.hostProvider,
		pathPrefix: config.publishing.pathPrefix,
		apexDomain: config.publishing.baseDomain
	});
}

export function publicPathPrefix(page: StatusPageInfo, requestHost: string): string {
	const host = stripPort(requestHost);
	if (page.publishMode === 'subdomain' && host === `${page.slug}.${getConfig().publishing.baseDomain}`) {
		return '';
	}
	return `/${getConfig().publishing.pathPrefix}/${page.slug}`;
}

export function parseSubdomainSlug(host: string, baseDomain: string): string | null {
	const h = stripPort(host);
	const base = baseDomain.toLowerCase();
	if (h === base || !h.endsWith(`.${base}`)) return null;
	const slug = h.slice(0, -(base.length + 1));
	if (!slug || slug.includes('.')) return null;
	return slug;
}

export function parsePathSlug(
	pathname: string,
	pathPrefix: string
): { slug: string; rest: string } | null {
	const prefix = `/${pathPrefix}/`;
	if (!pathname.startsWith(prefix)) return null;
	const restPath = pathname.slice(prefix.length);
	const slash = restPath.indexOf('/');
	const slug = slash === -1 ? restPath : restPath.slice(0, slash);
	if (!slug) return null;
	const rest = slash === -1 ? '/' : restPath.slice(slash) || '/';
	return { slug, rest };
}

export type { PublishMode, StatusPageInfo };
