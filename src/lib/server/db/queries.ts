import { and, desc, eq, gte, isNull, ne, sql } from 'drizzle-orm';
import {
	db,
	service,
	incident,
	incidentUpdate,
	incidentService,
	checkResult,
	user,
	statusPage
} from './index';
import { getConfig } from '$lib/server/config';
import { canonicalPageUrl } from '$lib/server/publishing';
import {
	isPublishMode,
	isValidSlug,
	pageInfoFromRow,
	type PublishMode,
	type StatusPageInfo
} from '$lib/publishing';
import { serializePageTheme, DEFAULT_PAGE_THEME } from '$lib/theme-config';
import {
	resolveServiceStatus,
	worstStatus,
	type ServiceStatus,
	type IncidentImpact,
	type IncidentStatus
} from '$lib/status';
import { toPublicCheckSettings } from '$lib/server/checks';
import type { PublicCheckSettings } from '$lib/checks';

export type ServiceRow = {
	id: string;
	statusPageId: string;
	name: string;
	description: string | null;
	sortOrder: number;
	checkUrl: string | null;
	expectedStatus: number;
	checkType: string | null;
	checkConfig: string | null;
	manualStatus: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type IncidentRow = {
	id: string;
	statusPageId: string;
	title: string;
	status: string;
	impact: string;
	createdAt: Date;
	updatedAt: Date;
	resolvedAt: Date | null;
};

export type IncidentUpdateRow = {
	id: string;
	incidentId: string;
	body: string;
	status: string;
	createdAt: Date;
};

export type CheckResultRow = {
	id: string;
	serviceId: string;
	ok: boolean;
	latencyMs: number | null;
	statusCode: number | null;
	error: string | null;
	checkedAt: Date;
};

export type StatusPageRow = {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	publishMode: string;
	hostProvider: string;
	ownerId: string | null;
	teamId: string;
	themeJson: string | null;
	deployUrl: string | null;
	deployProviderId: string | null;
	lastDeployedAt: Date | null;
	lastDeployError: string | null;
	published: boolean;
	deletedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type ServiceView = Omit<ServiceRow, 'checkConfig'> & {
	status: ServiceStatus;
	latestCheck: CheckResultRow | null;
	uptime90d: number | null;
	checkSettings: PublicCheckSettings | null;
};

export type DailyUptimeBucket = {
	date: string;
	ok: number;
	total: number;
	uptime: number | null;
};

function toPageInfo(row: StatusPageRow): StatusPageInfo {
	return pageInfoFromRow(row);
}

export async function listStatusPages(ownerId?: string): Promise<StatusPageRow[]> {
	if (ownerId) {
		return db
			.select()
			.from(statusPage)
			.where(eq(statusPage.ownerId, ownerId))
			.orderBy(statusPage.name);
	}
	return db.select().from(statusPage).orderBy(statusPage.name);
}

/** Active (non-deleted) pages for admin pickers. */
export async function listActiveStatusPages(ownerId: string): Promise<StatusPageRow[]> {
	return db
		.select()
		.from(statusPage)
		.where(and(eq(statusPage.ownerId, ownerId), isNull(statusPage.deletedAt)))
		.orderBy(statusPage.name);
}

export async function getStatusPageById(id: string): Promise<StatusPageRow | undefined> {
	const rows = await db.select().from(statusPage).where(eq(statusPage.id, id)).limit(1);
	return rows[0];
}

export async function getOwnedStatusPage(
	id: string,
	ownerId: string
): Promise<StatusPageRow | undefined> {
	const rows = await db
		.select()
		.from(statusPage)
		.where(and(eq(statusPage.id, id), eq(statusPage.ownerId, ownerId)))
		.limit(1);
	return rows[0];
}

export async function getStatusPageBySlug(slug: string): Promise<StatusPageRow | undefined> {
	const rows = await db.select().from(statusPage).where(eq(statusPage.slug, slug)).limit(1);
	return rows[0];
}

export async function getStatusPageInfo(
	slug: string,
	mode?: PublishMode
): Promise<StatusPageInfo | null> {
	const row = await getStatusPageBySlug(slug);
	if (!row) return null;
	if (!row.published || row.deletedAt) return null;
	const info = toPageInfo(row);
	if (mode && info.publishMode !== mode) return null;
	return info;
}

/** Assign legacy pages with no owner to a user (one-time migration aid). */
export async function claimOrphanStatusPages(ownerId: string): Promise<number> {
	const orphans = await db.select().from(statusPage).where(isNull(statusPage.ownerId));
	if (orphans.length === 0) return 0;
	await db.update(statusPage).set({ ownerId }).where(isNull(statusPage.ownerId));
	return orphans.length;
}

/**
 * If this is the only user and they own nothing, inherit legacy unowned projects.
 * Avoids stealing orphans once multiple accounts exist.
 */
export async function adoptLegacyProjectsIfSoleUser(ownerId: string): Promise<void> {
	const owned = await listStatusPages(ownerId);
	if (owned.length > 0) return;
	const users = await countUsers();
	if (users !== 1) return;
	await claimOrphanStatusPages(ownerId);
}

async function allocateSlug(base: string): Promise<string> {
	let candidate = base;
	let n = 2;
	while (await getStatusPageBySlug(candidate)) {
		candidate = `${base}-${n}`.slice(0, 63);
		n += 1;
		if (n > 100) {
			candidate = `p-${crypto.randomUUID().slice(0, 8)}`;
			break;
		}
	}
	return candidate;
}

export function slugFromEmail(email: string): string {
	const local = email
		.split('@')[0]
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	if (isValidSlug(local)) return local;
	return `user-${crypto.randomUUID().slice(0, 8)}`;
}

/** Ensure the user has a team and that team has at least one project. */
export async function ensureDefaultStatusPage(ownerId: string, opts?: {
	name?: string;
	email?: string;
	teamId?: string;
}): Promise<StatusPageInfo> {
	const { ensureUserHasTeam, listActiveStatusPagesForTeam } = await import('$lib/server/teams');
	const teamRow = opts?.teamId
		? { id: opts.teamId }
		: await ensureUserHasTeam(ownerId, { name: opts?.name, email: opts?.email });

	const existing = await listActiveStatusPagesForTeam(teamRow.id);
	if (existing.length > 0) return toPageInfo(existing[0]);

	const { assertCanCreateStatusPage } = await import('$lib/server/billing/limits');
	await assertCanCreateStatusPage(teamRow.id);

	const config = getConfig();
	const id = crypto.randomUUID();
	const now = new Date();
	const name = opts?.name?.trim() || config.site.name;
	const slug = await allocateSlug(
		opts?.email ? slugFromEmail(opts.email) : `p-${id.slice(0, 8)}`
	);
	const theme = {
		...DEFAULT_PAGE_THEME,
		brandName: name
	};
	await db.insert(statusPage).values({
		id,
		slug,
		name,
		description: config.site.description,
		publishMode: 'path',
		hostProvider: 'vercel',
		ownerId,
		teamId: teamRow.id,
		themeJson: serializePageTheme(theme),
		createdAt: now,
		updatedAt: now
	});

	return toPageInfo({
		id,
		slug,
		name,
		description: config.site.description,
		publishMode: 'path',
		hostProvider: 'vercel',
		ownerId,
		teamId: teamRow.id,
		themeJson: serializePageTheme(theme),
		deployUrl: null,
		deployProviderId: null,
		lastDeployedAt: null,
		lastDeployError: null,
		published: true,
		deletedAt: null,
		createdAt: now,
		updatedAt: now
	});
}

export async function listServices(statusPageId: string): Promise<ServiceRow[]> {
	return db
		.select()
		.from(service)
		.where(eq(service.statusPageId, statusPageId))
		.orderBy(service.sortOrder, service.name);
}

export async function getService(id: string): Promise<ServiceRow | undefined> {
	const rows = await db.select().from(service).where(eq(service.id, id)).limit(1);
	return rows[0];
}

export async function latestChecksByService(): Promise<Map<string, CheckResultRow>> {
	const rows: CheckResultRow[] = await db
		.select()
		.from(checkResult)
		.orderBy(desc(checkResult.checkedAt));

	const map = new Map<string, CheckResultRow>();
	for (const row of rows) {
		if (!map.has(row.serviceId)) map.set(row.serviceId, row);
	}
	return map;
}

export async function uptimeByService(days = 90): Promise<Map<string, number>> {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	const rows: Array<{ serviceId: string; total: number; ok: number }> = await db
		.select({
			serviceId: checkResult.serviceId,
			total: sql<number>`count(*)`.mapWith(Number),
			ok: sql<number>`sum(case when ${checkResult.ok} then 1 else 0 end)`.mapWith(Number)
		})
		.from(checkResult)
		.where(gte(checkResult.checkedAt, since))
		.groupBy(checkResult.serviceId);

	const map = new Map<string, number>();
	for (const row of rows) {
		if (row.total > 0) map.set(row.serviceId, row.ok / row.total);
	}
	return map;
}

/** Atlassian-style daily uptime buckets per service (UTC calendar days). */
export async function dailyUptimeBuckets(
	statusPageId: string,
	days = 90
): Promise<Record<string, DailyUptimeBucket[]>> {
	const services = await listServices(statusPageId);
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	since.setUTCHours(0, 0, 0, 0);

	const dayKeys: string[] = [];
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date();
		d.setUTCHours(0, 0, 0, 0);
		d.setUTCDate(d.getUTCDate() - i);
		dayKeys.push(d.toISOString().slice(0, 10));
	}

	const result: Record<string, DailyUptimeBucket[]> = {};
	for (const c of services) {
		result[c.id] = dayKeys.map((date) => ({
			date,
			ok: 0,
			total: 0,
			uptime: null
		}));
	}

	if (services.length === 0) return result;

	const serviceIds = new Set(services.map((c) => c.id));
	const rows: CheckResultRow[] = await db
		.select()
		.from(checkResult)
		.where(gte(checkResult.checkedAt, since));

	const byService = new Map<string, Map<string, { ok: number; total: number }>>();
	for (const row of rows) {
		if (!serviceIds.has(row.serviceId)) continue;
		const day = new Date(row.checkedAt).toISOString().slice(0, 10);
		let dayMap = byService.get(row.serviceId);
		if (!dayMap) {
			dayMap = new Map();
			byService.set(row.serviceId, dayMap);
		}
		const bucket = dayMap.get(day) ?? { ok: 0, total: 0 };
		bucket.total += 1;
		if (row.ok) bucket.ok += 1;
		dayMap.set(day, bucket);
	}

	for (const c of services) {
		const dayMap = byService.get(c.id);
		result[c.id] = dayKeys.map((date) => {
			const bucket = dayMap?.get(date);
			if (!bucket || bucket.total === 0) {
				return { date, ok: 0, total: 0, uptime: null };
			}
			return {
				date,
				ok: bucket.ok,
				total: bucket.total,
				uptime: bucket.ok / bucket.total
			};
		});
	}

	return result;
}

export async function getServiceViews(statusPageId: string): Promise<ServiceView[]> {
	const { checks } = getConfig();
	const [services, latest, uptime] = await Promise.all([
		listServices(statusPageId),
		latestChecksByService(),
		uptimeByService(90)
	]);

	return services.map((c) => {
		const latestCheck = latest.get(c.id) ?? null;
		const status = resolveServiceStatus({
			manualStatus: (c.manualStatus as ServiceStatus | null) ?? null,
			checkType: c.checkType,
			checkUrl: c.checkUrl,
			latestOk: latestCheck ? latestCheck.ok : null,
			latestLatencyMs: latestCheck?.latencyMs ?? null,
			degradedLatencyMs: checks.degradedLatencyMs
		});
		const { checkConfig, ...rest } = c;
		return {
			...rest,
			status,
			latestCheck,
			uptime90d: uptime.get(c.id) ?? null,
			checkSettings: toPublicCheckSettings(c.checkType, checkConfig)
		};
	});
}

export async function listIncidents(
	statusPageId: string,
	opts?: { activeOnly?: boolean; limit?: number }
) {
	const rows: IncidentRow[] = await db
		.select()
		.from(incident)
		.where(eq(incident.statusPageId, statusPageId))
		.orderBy(desc(incident.createdAt));
	let filtered = rows;
	if (opts?.activeOnly) {
		filtered = rows.filter((r) => r.status !== 'resolved');
	}
	if (opts?.limit) filtered = filtered.slice(0, opts.limit);
	return filtered as Array<IncidentRow & { status: IncidentStatus; impact: IncidentImpact }>;
}

export async function getIncident(
	id: string,
	statusPageId?: string
): Promise<IncidentRow | undefined> {
	const rows: IncidentRow[] = statusPageId
		? await db
				.select()
				.from(incident)
				.where(and(eq(incident.id, id), eq(incident.statusPageId, statusPageId)))
				.limit(1)
		: await db.select().from(incident).where(eq(incident.id, id)).limit(1);
	return rows[0];
}

export async function getIncidentUpdates(incidentId: string): Promise<IncidentUpdateRow[]> {
	return db
		.select()
		.from(incidentUpdate)
		.where(eq(incidentUpdate.incidentId, incidentId))
		.orderBy(desc(incidentUpdate.createdAt));
}

export async function getIncidentServiceIds(incidentId: string): Promise<string[]> {
	const rows: Array<{ serviceId: string }> = await db
		.select({ serviceId: incidentService.serviceId })
		.from(incidentService)
		.where(eq(incidentService.incidentId, incidentId));
	return rows.map((r) => r.serviceId);
}

export async function overallStatus(
	statusPageId: string,
	views: ServiceView[]
): Promise<ServiceStatus> {
	const active = await listIncidents(statusPageId, { activeOnly: true });
	if (active.length > 0) {
		const impactToStatus: Record<IncidentImpact, ServiceStatus> = {
			none: 'operational',
			minor: 'degraded',
			major: 'partial_outage',
			critical: 'major_outage'
		};
		const fromIncidents = active.map((i) => impactToStatus[i.impact as IncidentImpact]);
		const fromServices = views.map((v) => v.status);
		return worstStatus([...fromIncidents, ...fromServices]);
	}
	return worstStatus(views.map((v) => v.status));
}

export async function countUsers(): Promise<number> {
	const rows: Array<{ count: number }> = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(user);
	return rows[0]?.count ?? 0;
}

export async function getUserByEmail(
	email: string
): Promise<{ id: string; email: string; name: string } | null> {
	const rows = await db
		.select({ id: user.id, email: user.email, name: user.name })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	return rows[0] ?? null;
}

export async function listPublicPages() {
	const pages = await listStatusPages();
	return pages.map((p) => {
		const info = toPageInfo(p);
		return { ...info, url: info.deployUrl ?? canonicalPageUrl(info) };
	});
}

export { and, eq, ne, desc, gte, isValidSlug, isPublishMode, toPageInfo };
