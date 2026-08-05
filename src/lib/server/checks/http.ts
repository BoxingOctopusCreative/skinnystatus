import type { CheckOutcome } from './types';
import { failOutcome } from './types';

export async function runHttpCheck(
	checkUrl: string,
	expectedStatus: number,
	timeoutMs: number
): Promise<CheckOutcome> {
	const startedAt = Date.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);
		const response = await fetch(checkUrl, {
			method: 'GET',
			redirect: 'follow',
			signal: controller.signal,
			headers: { 'user-agent': 'SkinnyStatus/0.1' }
		});
		clearTimeout(timeout);
		const latencyMs = Date.now() - startedAt;
		const ok = response.status === expectedStatus;
		return {
			ok,
			latencyMs,
			statusCode: response.status,
			error: ok ? null : `Expected ${expectedStatus}, got ${response.status}`
		};
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'Check failed');
	}
}
