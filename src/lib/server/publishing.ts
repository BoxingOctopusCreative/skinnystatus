import { getConfig } from '$lib/server/config';
import { getTeamById } from '$lib/server/teams';
import {
	formatPublishUrlHint,
	PLATFORM_PATH_PREFIX,
	type PublishMode,
	type StatusPageInfo
} from '$lib/publishing';

export function apexHost(): string {
	const config = getConfig();
	try {
		return new URL(config.site.baseUrl).host.toLowerCase();
	} catch {
		return 'localhost';
	}
}

export function stripPort(host: string): string {
	return host.replace(/:\d+$/, '').toLowerCase();
}

export type TeamPublishSettings = {
	publishBaseDomain: string | null;
	publishPathPrefix: string;
};

export async function getTeamPublishSettings(teamId: string): Promise<TeamPublishSettings> {
	const row = await getTeamById(teamId);
	return {
		publishBaseDomain: row?.publishBaseDomain ?? null,
		publishPathPrefix: row?.publishPathPrefix || 's'
	};
}

export async function canonicalPageUrl(
	page: Pick<StatusPageInfo, 'slug' | 'publishMode' | 'deployUrl' | 'teamId'>
): Promise<string> {
	if (page.deployUrl) return page.deployUrl;
	const config = getConfig();
	const settings = await getTeamPublishSettings(page.teamId);
	if (page.publishMode === 'subdomain') {
		const proto = config.site.baseUrl.startsWith('https') ? 'https' : 'http';
		const apex = settings.publishBaseDomain || '<base-domain>';
		return `${proto}://${page.slug}.${apex}`;
	}
	const base = config.site.baseUrl.replace(/\/$/, '');
	// Admin preview uses the platform-fixed path; public path URLs use the team prefix after deploy.
	return `${base}/${PLATFORM_PATH_PREFIX}/${page.slug}`;
}

/** Expected static publish URL hints (before first deploy). */
export async function publishUrlHint(
	page: Pick<StatusPageInfo, 'slug' | 'publishMode' | 'hostProvider' | 'teamId'>
): Promise<string> {
	const settings = await getTeamPublishSettings(page.teamId);
	return formatPublishUrlHint({
		slug: page.slug,
		publishMode: page.publishMode,
		hostProvider: page.hostProvider,
		pathPrefix: settings.publishPathPrefix,
		apexDomain: settings.publishBaseDomain ?? ''
	});
}

/** Path prefix injected into the static board for API-relative links. */
export function publicPathPrefix(page: StatusPageInfo, _requestHost: string): string {
	if (page.publishMode === 'subdomain') return '';
	return `/${PLATFORM_PATH_PREFIX}/${page.slug}`;
}

export function parseSubdomainSlug(host: string, baseDomain: string): string | null {
	const h = stripPort(host);
	const base = baseDomain.toLowerCase();
	if (!base || h === base || !h.endsWith(`.${base}`)) return null;
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
