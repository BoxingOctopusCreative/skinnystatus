import Stripe from 'stripe';
import { PAID_PLAN_IDS, isPlanId, type PlanId } from '$lib/plans';
import {
	getBillingOrgById,
	getBillingOrgByStripeCustomerId,
	updateBillingOrgStripe,
	type BillingOrgRow
} from '$lib/server/billing/orgs';
import { getConfig } from '$lib/server/config';
import { eq } from 'drizzle-orm';
import { db, user } from '$lib/server/db';

/** Preview API version required for Managed Payments Checkout Sessions. */
export const MANAGED_PAYMENTS_API_VERSION = '2026-02-25.preview';

/** Eligible digital-goods tax code for Managed Payments. */
export const MANAGED_PAYMENTS_TAX_CODE = 'txcd_10103100';

let stripeClient: Stripe | null = null;

export function isStripeConfigured(): boolean {
	const { stripe } = getConfig();
	return Boolean(stripe.secretKey);
}

export function getStripe(): Stripe {
	const { stripe } = getConfig();
	if (!stripe.secretKey) {
		throw new Error('Stripe is not configured (STRIPE_SECRET_KEY)');
	}
	if (!stripeClient) {
		stripeClient = new Stripe(stripe.secretKey);
	}
	return stripeClient;
}

/** Test helper. */
export function resetStripeClientForTests(): void {
	stripeClient = null;
}

export function priceIdForPlan(planId: Exclude<PlanId, 'free'>): string | null {
	return getConfig().stripe.priceIds[planId];
}

export function planIdFromPriceId(priceId: string | null | undefined): PlanId | null {
	if (!priceId) return null;
	const { priceIds } = getConfig().stripe;
	for (const planId of PAID_PLAN_IDS) {
		if (priceIds[planId] && priceIds[planId] === priceId) return planId;
	}
	return null;
}

export function subscriptionKeepsPaidPlan(status: string | null | undefined): boolean {
	return status === 'active' || status === 'past_due' || status === 'trialing';
}

async function ensureStripeCustomer(org: BillingOrgRow, email: string): Promise<string> {
	if (org.stripeCustomerId) return org.stripeCustomerId;

	const stripe = getStripe();
	const customer = await stripe.customers.create({
		email,
		name: org.name,
		metadata: { billingOrgId: org.id }
	});
	await updateBillingOrgStripe(org.id, { stripeCustomerId: customer.id });
	return customer.id;
}

export async function createCheckoutSession(opts: {
	orgId: string;
	userId: string;
	planId: Exclude<PlanId, 'free'>;
}): Promise<{ url: string }> {
	const priceId = priceIdForPlan(opts.planId);
	if (!priceId) {
		throw new Error(`Stripe price is not configured for ${opts.planId}`);
	}

	const org = await getBillingOrgById(opts.orgId);
	if (!org) throw new Error('Billing org not found');

	const [u] = await db
		.select({ email: user.email })
		.from(user)
		.where(eq(user.id, opts.userId))
		.limit(1);
	if (!u?.email) throw new Error('User email required for checkout');

	const customerId = await ensureStripeCustomer(org, u.email);
	const baseUrl = getConfig().site.baseUrl.replace(/\/$/, '');
	const stripe = getStripe();

	// Existing subscription: swap price instead of opening a second Checkout.
	if (org.stripeSubscriptionId && subscriptionKeepsPaidPlan(org.stripeSubscriptionStatus)) {
		const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
		const itemId = sub.items.data[0]?.id;
		if (!itemId) throw new Error('Subscription has no line items to update');
		const updated = await stripe.subscriptions.update(org.stripeSubscriptionId, {
			items: [{ id: itemId, price: priceId }],
			proration_behavior: 'create_prorations',
			metadata: {
				billingOrgId: org.id,
				planId: opts.planId
			}
		});
		await syncOrgFromSubscription(updated, org.id);
		return { url: `${baseUrl}/dashboard/billing?checkout=success` };
	}

	// Managed Payments is merchant of record: it calculates tax and collects
	// name/address. Do not pass automatic_tax or customer_update.
	const session = await stripe.checkout.sessions.create(
		{
			mode: 'subscription',
			customer: customerId,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: `${baseUrl}/dashboard/billing?checkout=success`,
			cancel_url: `${baseUrl}/dashboard/billing?checkout=cancel`,
			managed_payments: { enabled: true },
			metadata: {
				billingOrgId: org.id,
				planId: opts.planId
			},
			subscription_data: {
				metadata: {
					billingOrgId: org.id,
					planId: opts.planId
				}
			}
		},
		{ apiVersion: MANAGED_PAYMENTS_API_VERSION }
	);

	if (!session.url) throw new Error('Stripe Checkout session missing URL');
	return { url: session.url };
}

export async function createBillingPortalSession(opts: {
	orgId: string;
}): Promise<{ url: string }> {
	const org = await getBillingOrgById(opts.orgId);
	if (!org?.stripeCustomerId) {
		throw new Error('No Stripe customer for this org yet');
	}
	const baseUrl = getConfig().site.baseUrl.replace(/\/$/, '');
	const stripe = getStripe();
	const session = await stripe.billingPortal.sessions.create({
		customer: org.stripeCustomerId,
		return_url: `${baseUrl}/dashboard/billing`
	});
	return { url: session.url };
}

function periodEndFromSubscription(sub: Stripe.Subscription): Date | null {
	const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
	if (typeof end === 'number') return new Date(end * 1000);
	const itemEnd = sub.items?.data?.[0]?.current_period_end;
	if (typeof itemEnd === 'number') return new Date(itemEnd * 1000);
	return null;
}

function priceIdFromSubscription(sub: Stripe.Subscription): string | null {
	const item = sub.items?.data?.[0];
	const price = item?.price;
	if (!price) return null;
	return typeof price === 'string' ? price : price.id;
}

export async function syncOrgFromSubscription(
	sub: Stripe.Subscription,
	fallbackOrgId?: string | null
): Promise<void> {
	const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
	let org =
		(customerId ? await getBillingOrgByStripeCustomerId(customerId) : undefined) ??
		(fallbackOrgId ? await getBillingOrgById(fallbackOrgId) : undefined);

	const metaOrgId = sub.metadata?.billingOrgId;
	if (!org && metaOrgId) {
		org = await getBillingOrgById(metaOrgId);
	}
	if (!org) {
		console.warn('[skinnystatus] Stripe subscription has no matching billing org', sub.id);
		return;
	}

	const status = sub.status;
	if (!subscriptionKeepsPaidPlan(status)) {
		await updateBillingOrgStripe(org.id, {
			planId: 'free',
			stripeSubscriptionId: null,
			stripeSubscriptionStatus: status,
			currentPeriodEnd: null
		});
		return;
	}

	const priceId = priceIdFromSubscription(sub);
	const fromPrice = planIdFromPriceId(priceId);
	const fromMeta =
		sub.metadata?.planId && isPlanId(sub.metadata.planId) && sub.metadata.planId !== 'free'
			? sub.metadata.planId
			: null;
	const resolved: PlanId | null =
		fromPrice ??
		fromMeta ??
		(isPlanId(org.planId) && org.planId !== 'free' ? org.planId : null);

	if (!resolved) {
		console.warn(
			'[skinnystatus] Active Stripe subscription has no mapped plan price',
			sub.id,
			priceId
		);
		await updateBillingOrgStripe(org.id, {
			stripeCustomerId: customerId ?? org.stripeCustomerId,
			stripeSubscriptionId: sub.id,
			stripeSubscriptionStatus: status,
			currentPeriodEnd: periodEndFromSubscription(sub)
		});
		return;
	}

	await updateBillingOrgStripe(org.id, {
		planId: resolved,
		stripeCustomerId: customerId ?? org.stripeCustomerId,
		stripeSubscriptionId: sub.id,
		stripeSubscriptionStatus: status,
		currentPeriodEnd: periodEndFromSubscription(sub)
	});
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
	switch (event.type) {
		case 'checkout.session.completed': {
			const session = event.data.object as Stripe.Checkout.Session;
			if (session.mode !== 'subscription') return;
			const orgId = session.metadata?.billingOrgId;
			const planMeta = session.metadata?.planId;
			const subId =
				typeof session.subscription === 'string'
					? session.subscription
					: session.subscription?.id;
			const customerId =
				typeof session.customer === 'string' ? session.customer : session.customer?.id;

			if (orgId && customerId) {
				await updateBillingOrgStripe(orgId, {
					stripeCustomerId: customerId,
					...(subId ? { stripeSubscriptionId: subId } : {}),
					...(planMeta && isPlanId(planMeta) && planMeta !== 'free'
						? { planId: planMeta, stripeSubscriptionStatus: 'active' }
						: {})
				});
			}

			if (subId) {
				const sub = await getStripe().subscriptions.retrieve(subId);
				await syncOrgFromSubscription(sub, orgId);
			}
			return;
		}
		case 'customer.subscription.updated':
		case 'customer.subscription.created': {
			const sub = event.data.object as Stripe.Subscription;
			await syncOrgFromSubscription(sub);
			return;
		}
		case 'customer.subscription.deleted': {
			const sub = event.data.object as Stripe.Subscription;
			const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
			const org =
				(customerId ? await getBillingOrgByStripeCustomerId(customerId) : undefined) ??
				(sub.metadata?.billingOrgId
					? await getBillingOrgById(sub.metadata.billingOrgId)
					: undefined);
			if (!org) return;
			await updateBillingOrgStripe(org.id, {
				planId: 'free',
				stripeSubscriptionId: null,
				stripeSubscriptionStatus: 'canceled',
				currentPeriodEnd: null
			});
			return;
		}
		default:
			return;
	}
}

export function constructStripeEvent(rawBody: string, signature: string): Stripe.Event {
	const secret = getConfig().stripe.webhookSecret;
	if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
	return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}
