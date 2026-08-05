import { and, eq, isNull, sql } from 'drizzle-orm';
import { type PlanId } from '$lib/plans';
import {
	countTeamsForOrg,
	effectivePlanId,
	getBillingOrgById,
	getOrgPlanDefinition,
	type BillingOrgRow
} from '$lib/server/billing/orgs';
import { db, service, statusPage, team } from '$lib/server/db';

export type LimitKind = 'teams' | 'pages' | 'services';

export class LimitError extends Error {
	readonly kind: LimitKind;
	readonly limit: number;
	readonly used: number;
	readonly planId: PlanId;

	constructor(kind: LimitKind, limit: number, used: number, planId: PlanId) {
		super(limitMessage(kind, limit, used, planId));
		this.name = 'LimitError';
		this.kind = kind;
		this.limit = limit;
		this.used = used;
		this.planId = planId;
	}
}

function limitMessage(kind: LimitKind, limit: number, used: number, planId: PlanId): string {
	if (kind === 'teams') {
		return `Your ${planId} plan allows ${limit} team${limit === 1 ? '' : 's'}. You have ${used}. Upgrade or delete a team to continue.`;
	}
	if (kind === 'pages') {
		return `Your ${planId} plan allows ${limit} status page${limit === 1 ? '' : 's'} per team. This team has ${used}. Upgrade or delete a page to continue.`;
	}
	return `Your ${planId} plan allows ${limit} service${limit === 1 ? '' : 's'} per status page. This page has ${used}. Upgrade or remove a service to continue.`;
}

export function isLimitError(err: unknown): err is LimitError {
	return err instanceof LimitError;
}

export async function countActivePagesForTeam(teamId: string): Promise<number> {
	const rows: Array<{ count: number }> = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(statusPage)
		.where(and(eq(statusPage.teamId, teamId), isNull(statusPage.deletedAt)));
	return rows[0]?.count ?? 0;
}

export async function countServicesForPage(statusPageId: string): Promise<number> {
	const rows: Array<{ count: number }> = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(service)
		.where(eq(service.statusPageId, statusPageId));
	return rows[0]?.count ?? 0;
}

export async function assertCanCreateTeam(orgId: string): Promise<BillingOrgRow> {
	const org = await getBillingOrgById(orgId);
	if (!org) throw new Error('Billing org not found');
	const plan = getOrgPlanDefinition(org);
	const used = await countTeamsForOrg(orgId);
	if (used >= plan.maxTeams) {
		throw new LimitError('teams', plan.maxTeams, used, effectivePlanId(org));
	}
	return org;
}

export async function assertCanCreateStatusPage(teamId: string): Promise<void> {
	const [row] = await db
		.select({ billingOrgId: team.billingOrgId })
		.from(team)
		.where(eq(team.id, teamId))
		.limit(1);
	if (!row) throw new Error('Team not found');
	const org = await getBillingOrgById(row.billingOrgId);
	if (!org) throw new Error('Billing org not found');
	const plan = getOrgPlanDefinition(org);
	const used = await countActivePagesForTeam(teamId);
	if (used >= plan.maxStatusPagesPerTeam) {
		throw new LimitError('pages', plan.maxStatusPagesPerTeam, used, effectivePlanId(org));
	}
}

export async function assertCanCreateService(statusPageId: string): Promise<void> {
	const [page] = await db
		.select({
			id: statusPage.id,
			teamId: statusPage.teamId,
			billingOrgId: team.billingOrgId
		})
		.from(statusPage)
		.innerJoin(team, eq(team.id, statusPage.teamId))
		.where(eq(statusPage.id, statusPageId))
		.limit(1);
	if (!page) throw new Error('Status page not found');
	const org = await getBillingOrgById(page.billingOrgId);
	if (!org) throw new Error('Billing org not found');
	const plan = getOrgPlanDefinition(org);
	const used = await countServicesForPage(statusPageId);
	if (used >= plan.maxServicesPerStatusPage) {
		throw new LimitError('services', plan.maxServicesPerStatusPage, used, effectivePlanId(org));
	}
}

export type OrgUsage = {
	teams: { used: number; limit: number };
	pagesOnTeam: { used: number; limit: number; teamId: string };
	servicesOnPage: { used: number; limit: number; pageId: string } | null;
};

export async function getOrgUsage(
	orgId: string,
	teamId: string,
	pageId?: string | null
): Promise<OrgUsage> {
	const org = await getBillingOrgById(orgId);
	if (!org) throw new Error('Billing org not found');
	const plan = getOrgPlanDefinition(org);
	const teamsUsed = await countTeamsForOrg(orgId);
	const pagesUsed = await countActivePagesForTeam(teamId);
	let servicesOnPage: OrgUsage['servicesOnPage'] = null;
	if (pageId) {
		const servicesUsed = await countServicesForPage(pageId);
		servicesOnPage = {
			used: servicesUsed,
			limit: plan.maxServicesPerStatusPage,
			pageId
		};
	}
	return {
		teams: { used: teamsUsed, limit: plan.maxTeams },
		pagesOnTeam: { used: pagesUsed, limit: plan.maxStatusPagesPerTeam, teamId },
		servicesOnPage
	};
}
