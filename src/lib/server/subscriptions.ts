import { and, eq } from 'drizzle-orm';
import { db, subscriber, statusPage } from '$lib/server/db';
import { getConfig } from '$lib/server/config';
import { isMailgunConfigured, sendEmail } from '$lib/server/mailgun';
import { canonicalPageUrl } from '$lib/server/publishing';
import { pageInfoFromRow } from '$lib/publishing';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
	return EMAIL_RE.test(email) && email.length <= 254;
}

export type SubscriberRow = {
	id: string;
	statusPageId: string;
	email: string;
	unsubscribeToken: string;
	createdAt: Date;
};

export async function listSubscribers(statusPageId: string): Promise<SubscriberRow[]> {
	return db.select().from(subscriber).where(eq(subscriber.statusPageId, statusPageId));
}

export async function findSubscriberByToken(
	token: string
): Promise<SubscriberRow | undefined> {
	const rows = await db
		.select()
		.from(subscriber)
		.where(eq(subscriber.unsubscribeToken, token))
		.limit(1);
	return rows[0];
}

export async function subscribeEmail(
	statusPageId: string,
	emailRaw: string
): Promise<{ created: boolean; subscriber: SubscriberRow }> {
	const email = emailRaw.trim().toLowerCase();
	if (!isValidEmail(email)) {
		throw new Error('Invalid email address');
	}

	const existing = await db
		.select()
		.from(subscriber)
		.where(and(eq(subscriber.statusPageId, statusPageId), eq(subscriber.email, email)))
		.limit(1);

	if (existing[0]) {
		return { created: false, subscriber: existing[0] };
	}

	const row: SubscriberRow = {
		id: crypto.randomUUID(),
		statusPageId,
		email,
		unsubscribeToken: crypto.randomUUID(),
		createdAt: new Date()
	};

	await db.insert(subscriber).values(row);
	return { created: true, subscriber: row };
}

export async function unsubscribeByToken(token: string): Promise<boolean> {
	const row = await findSubscriberByToken(token);
	if (!row) return false;
	await db.delete(subscriber).where(eq(subscriber.id, row.id));
	return true;
}

function unsubscribeUrl(token: string): string {
	const base = getConfig().site.baseUrl.replace(/\/$/, '');
	return `${base}/api/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

function pagePublicUrl(page: {
	slug: string;
	publishMode: string;
	deployUrl: string | null;
	hostProvider?: string | null;
	themeJson?: string | null;
	name: string;
	description: string | null;
	id: string;
}): string {
	const info = pageInfoFromRow(page);
	return info.deployUrl ?? canonicalPageUrl(info);
}

export async function sendWelcomeEmail(
	pageName: string,
	pageUrl: string,
	sub: SubscriberRow
): Promise<void> {
	if (!isMailgunConfigured()) return;

	const unsub = unsubscribeUrl(sub.unsubscribeToken);
	await sendEmail({
		to: sub.email,
		subject: `Subscribed to ${pageName} status updates`,
		text: [
			`You are subscribed to status alerts for ${pageName}.`,
			``,
			`View status: ${pageUrl}`,
			`Unsubscribe: ${unsub}`
		].join('\n'),
		html: `
			<p>You are subscribed to status alerts for <strong>${escapeHtml(pageName)}</strong>.</p>
			<p><a href="${escapeAttr(pageUrl)}">View status page</a></p>
			<p style="color:#666;font-size:12px"><a href="${escapeAttr(unsub)}">Unsubscribe</a></p>
		`
	});
}

export async function notifyIncidentAlert(input: {
	statusPageId: string;
	incidentTitle: string;
	incidentStatus: string;
	incidentImpact: string;
	updateBody: string;
	kind: 'created' | 'updated';
}): Promise<void> {
	if (!isMailgunConfigured()) return;

	const pages = await db
		.select()
		.from(statusPage)
		.where(eq(statusPage.id, input.statusPageId))
		.limit(1);
	const page = pages[0];
	if (!page) return;

	const subs = await listSubscribers(input.statusPageId);
	if (subs.length === 0) return;

	const pageUrl = pagePublicUrl(page);
	const verb = input.kind === 'created' ? 'New incident' : 'Incident update';
	const subject = `[${page.name}] ${verb}: ${input.incidentTitle}`;

	await Promise.allSettled(
		subs.map((sub) => {
			const unsub = unsubscribeUrl(sub.unsubscribeToken);
			return sendEmail({
				to: sub.email,
				subject,
				text: [
					`${verb} on ${page.name}`,
					``,
					`Title: ${input.incidentTitle}`,
					`Status: ${input.incidentStatus}`,
					`Impact: ${input.incidentImpact}`,
					``,
					input.updateBody,
					``,
					`View status: ${pageUrl}`,
					`Unsubscribe: ${unsub}`
				].join('\n'),
				html: `
					<p><strong>${escapeHtml(verb)}</strong> on ${escapeHtml(page.name)}</p>
					<p>
						<strong>${escapeHtml(input.incidentTitle)}</strong><br/>
						Status: ${escapeHtml(input.incidentStatus)} · Impact: ${escapeHtml(input.incidentImpact)}
					</p>
					<p>${escapeHtml(input.updateBody)}</p>
					<p><a href="${escapeAttr(pageUrl)}">View status page</a></p>
					<p style="color:#666;font-size:12px"><a href="${escapeAttr(unsub)}">Unsubscribe</a></p>
				`
			});
		})
	);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function escapeAttr(value: string): string {
	return escapeHtml(value).replaceAll("'", '&#39;');
}
