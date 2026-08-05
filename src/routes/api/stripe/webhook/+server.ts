import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { constructStripeEvent, handleStripeEvent, isStripeConfigured } from '$lib/server/billing/stripe';

export const POST: RequestHandler = async ({ request }) => {
	if (!isStripeConfigured()) {
		return json({ error: 'Stripe is not configured' }, { status: 503 });
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		return json({ error: 'Missing stripe-signature' }, { status: 400 });
	}

	const rawBody = await request.text();

	let event;
	try {
		event = constructStripeEvent(rawBody, signature);
	} catch (err) {
		console.error('[skinnystatus] Stripe webhook signature failed', err);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	try {
		await handleStripeEvent(event);
	} catch (err) {
		console.error('[skinnystatus] Stripe webhook handler failed', err);
		return json({ error: 'Webhook handler failed' }, { status: 500 });
	}

	return json({ received: true });
};
