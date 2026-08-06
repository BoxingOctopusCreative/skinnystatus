import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { jsonWithCors, optionsCors } from '$lib/server/api-cors';
import { db, subscriber } from '$lib/server/db';
import { getStatusPageBySlug } from '$lib/server/db/queries';
import { isMailgunConfigured } from '$lib/server/mailgun';
import {
	isValidEmail,
	sendWelcomeEmail,
	subscribeEmail
} from '$lib/server/subscriptions';
import { canonicalPageUrl } from '$lib/server/publishing';
import { pageInfoFromRow } from '$lib/publishing';

export const OPTIONS: RequestHandler = async () => optionsCors();

export const POST: RequestHandler = async ({ params, request }) => {
	if (!isMailgunConfigured()) {
		return jsonWithCors(
			{ error: 'Email subscriptions are not configured on this install.' },
			{ status: 503 }
		);
	}

	const row = await getStatusPageBySlug(params.slug);
	if (!row) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	let email = '';
	const contentType = request.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		const body = (await request.json()) as { email?: string };
		email = body.email?.toString() ?? '';
	} else {
		const form = await request.formData();
		email = form.get('email')?.toString() ?? '';
	}

	email = email.trim().toLowerCase();
	if (!isValidEmail(email)) {
		return jsonWithCors({ error: 'Enter a valid email address.' }, { status: 400 });
	}

	try {
		const result = await subscribeEmail(row.id, email);
		const page = pageInfoFromRow(row);
		const pageUrl = page.deployUrl ?? (await canonicalPageUrl(page));

		if (result.created) {
			try {
				await sendWelcomeEmail(page.name, pageUrl, result.subscriber);
			} catch (e) {
				await db.delete(subscriber).where(eq(subscriber.id, result.subscriber.id));
				throw e;
			}
		}

		return jsonWithCors({
			ok: true,
			created: result.created,
			message: result.created
				? 'Subscribed. Check your inbox for a confirmation.'
				: 'You are already subscribed to this status page.'
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Could not subscribe';
		return jsonWithCors({ error: message }, { status: 400 });
	}
};
