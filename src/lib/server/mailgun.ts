import { getConfig } from '$lib/server/config';

export function isMailgunConfigured(): boolean {
	const mg = getConfig().providers.mailgun;
	return Boolean(mg.apiKey && mg.domain && mg.from);
}

function mailgunBaseUrl(): string {
	const region = getConfig().providers.mailgun.region;
	return region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
}

export type SendEmailInput = {
	to: string;
	subject: string;
	text: string;
	html?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<void> {
	const mg = getConfig().providers.mailgun;
	if (!mg.apiKey || !mg.domain || !mg.from) {
		throw new Error(
			'Mailgun is not configured. Set Infisical /mailgun secrets (api_key, domain, from) or MAILGUN_* env vars.'
		);
	}

	const body = new URLSearchParams();
	body.set('from', mg.from);
	body.set('to', input.to);
	body.set('subject', input.subject);
	body.set('text', input.text);
	if (input.html) body.set('html', input.html);

	const auth = Buffer.from(`api:${mg.apiKey}`).toString('base64');
	const res = await fetch(`${mailgunBaseUrl()}/v3/${mg.domain}/messages`, {
		method: 'POST',
		headers: {
			Authorization: `Basic ${auth}`,
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		body
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Mailgun send failed (${res.status}): ${text.slice(0, 400)}`);
	}
}
