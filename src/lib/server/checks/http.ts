import type { HttpCheckConfig } from '$lib/checks';
import type { CheckOutcome } from './types';
import { failOutcome } from './types';

/**
 * Request headers for the configured credentials, or an empty object when the
 * check is unauthenticated or its config is incomplete. Header names and values
 * are validated when the config is saved.
 */
export function httpAuthHeaders(auth: HttpCheckConfig | null | undefined): Record<string, string> {
	if (!auth || auth.auth === 'none') return {};
	switch (auth.auth) {
		case 'bearer':
			return auth.token ? { authorization: `Bearer ${auth.token}` } : {};
		case 'basic': {
			if (!auth.username || !auth.password) return {};
			const encoded = Buffer.from(`${auth.username}:${auth.password}`, 'utf8').toString('base64');
			return { authorization: `Basic ${encoded}` };
		}
		case 'header':
			return auth.headerName && auth.headerValue
				? { [auth.headerName.toLowerCase()]: auth.headerValue }
				: {};
	}
}

export async function runHttpCheck(
	checkUrl: string,
	expectedStatus: number,
	timeoutMs: number,
	auth?: HttpCheckConfig | null
): Promise<CheckOutcome> {
	const startedAt = Date.now();
	const authHeaders = httpAuthHeaders(auth);
	const authenticated = Object.keys(authHeaders).length > 0;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(checkUrl, {
			method: 'GET',
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'user-agent': 'SkinnyStatus/0.1', ...authHeaders }
		});
		clearTimeout(timeout);
		const latencyMs = Date.now() - startedAt;
		const ok = response.status === expectedStatus;
		return {
			ok,
			latencyMs,
			statusCode: response.status,
			error: ok ? null : describeFailure(response.status, expectedStatus, authenticated)
		};
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'Check failed');
	}
}

function describeFailure(status: number, expectedStatus: number, authenticated: boolean): string {
	if (authenticated && (status === 401 || status === 403)) {
		return `Authentication failed: got ${status}, expected ${expectedStatus}`;
	}
	return `Expected ${expectedStatus}, got ${status}`;
}
