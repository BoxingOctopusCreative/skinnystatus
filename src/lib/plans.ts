/** SkinnyStatus subscription plans (CAD monthly). Shared by marketing and enforcement. */

export const PLAN_IDS = ['free', 'bronze', 'silver', 'gold', 'platinum'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type PlanDefinition = {
	id: PlanId;
	name: string;
	/** Monthly price in CAD. Free is 0. */
	priceCad: number;
	maxTeams: number;
	/** Active (non-deleted) status pages per team. */
	maxStatusPagesPerTeam: number;
	maxServicesPerStatusPage: number;
	/** Platinum entitlement; SSO UI ships later. */
	sso: boolean;
	/** Short marketing blurb. */
	tagline: string;
};

export const PLANS: Record<PlanId, PlanDefinition> = {
	free: {
		id: 'free',
		name: 'Free',
		priceCad: 0,
		maxTeams: 1,
		maxStatusPagesPerTeam: 2,
		maxServicesPerStatusPage: 3,
		sso: false,
		tagline: 'Start with one team and a couple of status pages.'
	},
	bronze: {
		id: 'bronze',
		name: 'Bronze',
		priceCad: 3,
		maxTeams: 1,
		maxStatusPagesPerTeam: 3,
		maxServicesPerStatusPage: 5,
		sso: false,
		tagline: 'More pages and services on a single team.'
	},
	silver: {
		id: 'silver',
		name: 'Silver',
		priceCad: 5,
		maxTeams: 2,
		maxStatusPagesPerTeam: 5,
		maxServicesPerStatusPage: 10,
		sso: false,
		tagline: 'Two teams and more pages for growing ops.'
	},
	gold: {
		id: 'gold',
		name: 'Gold',
		priceCad: 9,
		maxTeams: 5,
		maxStatusPagesPerTeam: 10,
		maxServicesPerStatusPage: 10,
		sso: false,
		tagline: 'More teams and pages for multi-product status.'
	},
	platinum: {
		id: 'platinum',
		name: 'Platinum',
		priceCad: 20,
		maxTeams: 10,
		maxStatusPagesPerTeam: 20,
		maxServicesPerStatusPage: 20,
		sso: true,
		tagline: 'Highest limits, plus custom SSO (coming soon).'
	}
};

export const PLAN_LIST: PlanDefinition[] = PLAN_IDS.map((id) => PLANS[id]);

export const PAID_PLAN_IDS = PLAN_IDS.filter((id) => id !== 'free') as Exclude<PlanId, 'free'>[];

export function isPlanId(value: string): value is PlanId {
	return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(id: string | null | undefined): PlanDefinition {
	if (id && isPlanId(id)) return PLANS[id];
	return PLANS.free;
}

export function formatPlanPrice(plan: PlanDefinition): string {
	if (plan.priceCad === 0) return '$0 CAD/mo';
	return `$${plan.priceCad} CAD/mo`;
}
