import { afterEach, describe, expect, it } from 'vitest';
import {
	getConfig,
	initConfig,
	resetConfigCache,
	resetDotEnvForTests
} from '$lib/server/config';
import {
	MANAGED_PAYMENTS_API_VERSION,
	MANAGED_PAYMENTS_TAX_CODE,
	planIdFromPriceId,
	resetStripeClientForTests,
	subscriptionKeepsPaidPlan
} from '$lib/server/billing/stripe';
import { LimitError } from '$lib/server/billing/limits';
import { effectivePlanId, type BillingOrgRow } from '$lib/server/billing/orgs';

const PG_URL = 'postgresql://skinnystatus:skinnystatus@localhost:5432/skinnystatus';

function disableInfisicalForTests(): void {
	process.env.INFISICAL_DISABLE = '1';
}

afterEach(() => {
	resetConfigCache();
	resetStripeClientForTests();
	resetDotEnvForTests();
	delete process.env.INFISICAL_DISABLE;
	delete process.env.DATABASE_URL;
	delete process.env.STRIPE_SECRET_KEY;
	delete process.env.STRIPE_PRICE_BRONZE;
	delete process.env.STRIPE_PRICE_SILVER;
	delete process.env.STRIPE_PRICE_GOLD;
	delete process.env.STRIPE_PRICE_PLATINUM;
});

function sampleOrg(overrides: Partial<BillingOrgRow> = {}): BillingOrgRow {
	const now = new Date();
	return {
		id: 'org-1',
		name: 'Test org',
		slug: 'test-org',
		planId: 'bronze',
		stripeCustomerId: 'cus_1',
		stripeSubscriptionId: 'sub_1',
		stripeSubscriptionStatus: 'active',
		currentPeriodEnd: now,
		createdByUserId: 'user-1',
		createdAt: now,
		updatedAt: now,
		...overrides
	};
}

describe('billing plan helpers', () => {
	it('keeps paid entitlements for active and past_due', () => {
		expect(subscriptionKeepsPaidPlan('active')).toBe(true);
		expect(subscriptionKeepsPaidPlan('past_due')).toBe(true);
		expect(subscriptionKeepsPaidPlan('trialing')).toBe(true);
		expect(subscriptionKeepsPaidPlan('canceled')).toBe(false);
		expect(subscriptionKeepsPaidPlan('unpaid')).toBe(false);
	});

	it('effectivePlanId drops to free when subscription is canceled or unpaid', () => {
		expect(effectivePlanId(sampleOrg({ stripeSubscriptionStatus: 'canceled' }))).toBe('free');
		expect(effectivePlanId(sampleOrg({ stripeSubscriptionStatus: 'unpaid' }))).toBe('free');
		expect(effectivePlanId(sampleOrg({ stripeSubscriptionStatus: 'active', planId: 'gold' }))).toBe(
			'gold'
		);
		expect(
			effectivePlanId(sampleOrg({ stripeSubscriptionStatus: 'past_due', planId: 'silver' }))
		).toBe('silver');
	});

	it('maps Stripe price ids to plan ids from config', async () => {
		disableInfisicalForTests();
		process.env.DATABASE_URL = PG_URL;
		process.env.STRIPE_SECRET_KEY = 'sk_test_x';
		process.env.STRIPE_PRICE_BRONZE = 'price_bronze';
		process.env.STRIPE_PRICE_SILVER = 'price_silver';
		process.env.STRIPE_PRICE_GOLD = 'price_gold';
		process.env.STRIPE_PRICE_PLATINUM = 'price_platinum';
		await initConfig();
		expect(getConfig().stripe.priceIds.bronze).toBe('price_bronze');
		expect(planIdFromPriceId('price_gold')).toBe('gold');
		expect(planIdFromPriceId('price_unknown')).toBeNull();
	});

	it('exposes Managed Payments API version and eligible tax code', () => {
		expect(MANAGED_PAYMENTS_API_VERSION).toBe('2026-02-25.preview');
		expect(MANAGED_PAYMENTS_TAX_CODE).toBe('txcd_10103100');
	});

	it('LimitError includes kind, used, and limit', () => {
		const err = new LimitError('pages', 2, 2, 'free');
		expect(err.kind).toBe('pages');
		expect(err.limit).toBe(2);
		expect(err.used).toBe(2);
		expect(err.planId).toBe('free');
		expect(err.message).toContain('status page');
		expect(err.message).toContain('Upgrade');
	});
});
