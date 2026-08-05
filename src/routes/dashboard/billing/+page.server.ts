import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { PAID_PLAN_IDS, PLAN_LIST, formatPlanPrice, isPlanId } from '$lib/plans';
import { getOrgUsage } from '$lib/server/billing/limits';
import {
	effectivePlanId,
	ensureUserBillingOrg,
	getOrgPlanDefinition,
	userCanManageBilling
} from '$lib/server/billing/orgs';
import {
	createBillingPortalSession,
	createCheckoutSession,
	isStripeConfigured,
	priceIdForPlan
} from '$lib/server/billing/stripe';
import { resolveCurrentTeam } from '$lib/server/dashboard-page';
import { listActiveStatusPagesForTeam } from '$lib/server/teams';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const org = await ensureUserBillingOrg(locals.user.id, {
		name: locals.user.name,
		email: locals.user.email
	});
	const canManage = await userCanManageBilling(org.id, locals.user.id);
	const plan = getOrgPlanDefinition(org);
	const planId = effectivePlanId(org);

	const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});

	const pages = await listActiveStatusPagesForTeam(team.id);
	const pageId = pages[0]?.id ?? null;

	const usage = await getOrgUsage(org.id, team.id, pageId);

	const stripeReady = isStripeConfigured();
	const availablePrices = Object.fromEntries(
		PAID_PLAN_IDS.map((id) => [id, Boolean(priceIdForPlan(id))])
	) as Record<(typeof PAID_PLAN_IDS)[number], boolean>;

	return {
		org: {
			id: org.id,
			name: org.name,
			planId,
			planName: plan.name,
			priceLabel: formatPlanPrice(plan),
			subscriptionStatus: org.stripeSubscriptionStatus,
			currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
			hasStripeCustomer: Boolean(org.stripeCustomerId)
		},
		canManage,
		stripeReady,
		availablePrices,
		usage,
		teamName: team.name,
		plans: PLAN_LIST.map((p) => ({
			id: p.id,
			name: p.name,
			priceCad: p.priceCad,
			priceLabel: formatPlanPrice(p),
			maxTeams: p.maxTeams,
			maxStatusPagesPerTeam: p.maxStatusPagesPerTeam,
			maxServicesPerStatusPage: p.maxServicesPerStatusPage,
			sso: p.sso,
			tagline: p.tagline,
			current: p.id === planId
		})),
		checkout: url.searchParams.get('checkout')
	};
};

export const actions: Actions = {
	checkout: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		if (!isStripeConfigured()) {
			return fail(503, { message: 'Billing is not configured on this install.' });
		}

		const form = await request.formData();
		const planRaw = form.get('planId')?.toString() ?? '';
		if (!isPlanId(planRaw) || planRaw === 'free') {
			return fail(400, { message: 'Choose a paid plan.' });
		}

		const org = await ensureUserBillingOrg(locals.user.id, {
			name: locals.user.name,
			email: locals.user.email
		});
		if (!(await userCanManageBilling(org.id, locals.user.id))) {
			return fail(403, { message: 'Only org owners and admins can change billing.' });
		}

		if (effectivePlanId(org) === planRaw && org.stripeSubscriptionId) {
			return fail(400, {
				message: 'You are already on this plan. Use Manage billing to change payment details.'
			});
		}

		try {
			const { url } = await createCheckoutSession({
				orgId: org.id,
				userId: locals.user.id,
				planId: planRaw
			});
			throw redirect(303, url);
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[skinnystatus] checkout session failed', err);
			return fail(500, {
				message: err instanceof Error ? err.message : 'Could not start checkout'
			});
		}
	},
	portal: async ({ locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		if (!isStripeConfigured()) {
			return fail(503, { message: 'Billing is not configured on this install.' });
		}

		const org = await ensureUserBillingOrg(locals.user.id, {
			name: locals.user.name,
			email: locals.user.email
		});
		if (!(await userCanManageBilling(org.id, locals.user.id))) {
			return fail(403, { message: 'Only org owners and admins can manage billing.' });
		}

		try {
			const { url } = await createBillingPortalSession({ orgId: org.id });
			throw redirect(303, url);
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[skinnystatus] billing portal failed', err);
			return fail(500, {
				message: err instanceof Error ? err.message : 'Could not open billing portal'
			});
		}
	}
};
