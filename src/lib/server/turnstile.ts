import { fail, type ActionFailure } from '@sveltejs/kit';
import { getConfig } from '$lib/server/config';

export function isTurnstileConfigured(): boolean {
	const ts = getConfig().turnstile;
	return Boolean(ts.siteKey && ts.secret);
}

export function getTurnstileSiteKey(): string | null {
	if (!isTurnstileConfigured()) return null;
	return getConfig().turnstile.siteKey;
}

/**
 * Canonical Cloudflare Turnstile siteverify.
 * When Turnstile is not configured, returns success so local/dev can skip the widget.
 */
export async function verifyTurnstileToken(
	token: string | null | undefined,
	remoteip?: string
): Promise<boolean> {
	const secret = getConfig().turnstile.secret;
	if (!secret) return true;
	if (!token) return false;

	const body = new URLSearchParams({
		secret,
		response: token
	});
	if (remoteip) body.set('remoteip', remoteip);

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});

	if (!res.ok) return false;

	const result = (await res.json()) as { success?: boolean };
	return result.success === true;
}

/** Gate a form action on Turnstile when configured. Returns a fail result, or null to continue. */
export async function requireTurnstile(
	formData: FormData,
	remoteip?: string
): Promise<ActionFailure<{ message: string }> | null> {
	if (!isTurnstileConfigured()) return null;

	const token = formData.get('cf-turnstile-response')?.toString() ?? '';
	const ok = await verifyTurnstileToken(token, remoteip);
	if (!ok) {
		return fail(403, { message: 'Verification failed. Please try again.' });
	}
	return null;
}
