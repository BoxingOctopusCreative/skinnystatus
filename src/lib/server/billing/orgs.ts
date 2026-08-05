import { and, eq, sql } from 'drizzle-orm';
import { getPlan, type PlanDefinition, type PlanId, isPlanId } from '$lib/plans';
import { billingOrg, billingOrgMember, db, team, user } from '$lib/server/db';
import type { BillingOrgRole } from '$lib/server/db/schema.pg';

export type BillingOrgRow = {
	id: string;
	name: string;
	slug: string;
	planId: string;
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	stripeSubscriptionStatus: string | null;
	currentPeriodEnd: Date | null;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
};

const ORG_ROLE_RANK: Record<BillingOrgRole, number> = {
	member: 1,
	admin: 2,
	owner: 3
};

export function isBillingOrgRole(value: string): value is BillingOrgRole {
	return value === 'owner' || value === 'admin' || value === 'member';
}

export function billingOrgRoleAtLeast(role: BillingOrgRole, min: BillingOrgRole): boolean {
	return ORG_ROLE_RANK[role] >= ORG_ROLE_RANK[min];
}

export function slugifyOrgName(name: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return base || `org-${crypto.randomUUID().slice(0, 8)}`;
}

async function allocateOrgSlug(base: string): Promise<string> {
	let candidate = base.slice(0, 63);
	let n = 2;
	while (true) {
		const [existing] = await db
			.select({ id: billingOrg.id })
			.from(billingOrg)
			.where(eq(billingOrg.slug, candidate))
			.limit(1);
		if (!existing) return candidate;
		candidate = `${base.slice(0, 50)}-${n}`.slice(0, 63);
		n += 1;
		if (n > 100) return `org-${crypto.randomUUID().slice(0, 8)}`;
	}
}

export async function getBillingOrgById(orgId: string): Promise<BillingOrgRow | undefined> {
	const [row] = await db.select().from(billingOrg).where(eq(billingOrg.id, orgId)).limit(1);
	return row;
}

export async function getBillingOrgByStripeCustomerId(
	customerId: string
): Promise<BillingOrgRow | undefined> {
	const [row] = await db
		.select()
		.from(billingOrg)
		.where(eq(billingOrg.stripeCustomerId, customerId))
		.limit(1);
	return row;
}

export async function getOrgMembership(
	orgId: string,
	userId: string
): Promise<{ id: string; role: string } | undefined> {
	const [row] = await db
		.select({ id: billingOrgMember.id, role: billingOrgMember.role })
		.from(billingOrgMember)
		.where(and(eq(billingOrgMember.orgId, orgId), eq(billingOrgMember.userId, userId)))
		.limit(1);
	return row;
}

export async function getOrgRole(orgId: string, userId: string): Promise<BillingOrgRole | null> {
	const membership = await getOrgMembership(orgId, userId);
	if (!membership || !isBillingOrgRole(membership.role)) return null;
	return membership.role;
}

export async function userCanManageBilling(orgId: string, userId: string): Promise<boolean> {
	const role = await getOrgRole(orgId, userId);
	return role != null && billingOrgRoleAtLeast(role, 'admin');
}

/** Effective plan for limit checks. Active and past_due keep paid entitlements. */
export function effectivePlanId(org: BillingOrgRow): PlanId {
	const status = org.stripeSubscriptionStatus;
	if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
		return 'free';
	}
	if (!isPlanId(org.planId)) return 'free';
	return org.planId;
}

export function getOrgPlanDefinition(org: BillingOrgRow): PlanDefinition {
	return getPlan(effectivePlanId(org));
}

export async function countTeamsForOrg(orgId: string): Promise<number> {
	const rows: Array<{ count: number }> = await db
		.select({ count: sql<number>`count(*)`.mapWith(Number) })
		.from(team)
		.where(eq(team.billingOrgId, orgId));
	return rows[0]?.count ?? 0;
}

/**
 * Home billing org where the user is owner. Creates one on Free if missing.
 */
export async function ensureUserBillingOrg(
	userId: string,
	opts?: { name?: string; email?: string }
): Promise<BillingOrgRow> {
	const owned = await db
		.select({
			id: billingOrg.id,
			name: billingOrg.name,
			slug: billingOrg.slug,
			planId: billingOrg.planId,
			stripeCustomerId: billingOrg.stripeCustomerId,
			stripeSubscriptionId: billingOrg.stripeSubscriptionId,
			stripeSubscriptionStatus: billingOrg.stripeSubscriptionStatus,
			currentPeriodEnd: billingOrg.currentPeriodEnd,
			createdByUserId: billingOrg.createdByUserId,
			createdAt: billingOrg.createdAt,
			updatedAt: billingOrg.updatedAt,
			role: billingOrgMember.role
		})
		.from(billingOrgMember)
		.innerJoin(billingOrg, eq(billingOrg.id, billingOrgMember.orgId))
		.where(and(eq(billingOrgMember.userId, userId), eq(billingOrgMember.role, 'owner')))
		.orderBy(billingOrg.createdAt)
		.limit(1);

	if (owned[0]) {
		const { role: _role, ...row } = owned[0];
		return row;
	}

	let label = opts?.name?.trim() || opts?.email?.split('@')[0]?.trim() || '';
	if (!label) {
		const [u] = await db
			.select({ name: user.name, email: user.email })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);
		label = u?.name?.trim() || u?.email?.split('@')[0]?.trim() || 'Personal';
	}

	const name = `${label}'s org`;
	const slug = await allocateOrgSlug(slugifyOrgName(`${label}-org`));
	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(billingOrg).values({
		id,
		name,
		slug,
		planId: 'free',
		createdByUserId: userId,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(billingOrgMember).values({
		id: crypto.randomUUID(),
		orgId: id,
		userId,
		role: 'owner',
		createdAt: now
	});

	return {
		id,
		name,
		slug,
		planId: 'free',
		stripeCustomerId: null,
		stripeSubscriptionId: null,
		stripeSubscriptionStatus: null,
		currentPeriodEnd: null,
		createdByUserId: userId,
		createdAt: now,
		updatedAt: now
	};
}

export async function updateBillingOrgStripe(
	orgId: string,
	patch: {
		planId?: PlanId;
		stripeCustomerId?: string | null;
		stripeSubscriptionId?: string | null;
		stripeSubscriptionStatus?: string | null;
		currentPeriodEnd?: Date | null;
	}
): Promise<void> {
	await db
		.update(billingOrg)
		.set({
			...(patch.planId !== undefined ? { planId: patch.planId } : {}),
			...(patch.stripeCustomerId !== undefined
				? { stripeCustomerId: patch.stripeCustomerId }
				: {}),
			...(patch.stripeSubscriptionId !== undefined
				? { stripeSubscriptionId: patch.stripeSubscriptionId }
				: {}),
			...(patch.stripeSubscriptionStatus !== undefined
				? { stripeSubscriptionStatus: patch.stripeSubscriptionStatus }
				: {}),
			...(patch.currentPeriodEnd !== undefined
				? { currentPeriodEnd: patch.currentPeriodEnd }
				: {}),
			updatedAt: new Date()
		})
		.where(eq(billingOrg.id, orgId));
}
