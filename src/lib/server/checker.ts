import { lt, eq } from 'drizzle-orm';
import { building } from '$app/environment';
import { getConfig } from '$lib/server/config';
import { db, service, checkResult } from '$lib/server/db';
import { runServiceCheck } from '$lib/server/checks';
import { isCheckType } from '$lib/checks';

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

async function runChecks(): Promise<void> {
	const config = getConfig();
	const services = await db.select().from(service);

	for (const c of services) {
		const checkType =
			c.checkType && isCheckType(c.checkType)
				? c.checkType
				: c.checkUrl
					? 'http'
					: null;
		if (!checkType) continue;

		const outcome = await runServiceCheck(
			{
				checkType,
				checkUrl: c.checkUrl,
				expectedStatus: c.expectedStatus,
				checkConfig: c.checkConfig
			},
			config.checks.timeoutMs
		);

		await db.insert(checkResult).values({
			serviceId: c.id,
			ok: outcome.ok,
			latencyMs: outcome.latencyMs,
			statusCode: outcome.statusCode,
			error: outcome.error
		});

		await db
			.update(service)
			.set({ updatedAt: new Date() })
			.where(eq(service.id, c.id));
	}

	await pruneOldResults();
}

async function pruneOldResults(): Promise<void> {
	const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
	await db.delete(checkResult).where(lt(checkResult.checkedAt, cutoff));
}

export function startChecker(): void {
	if (building || started) return;
	started = true;

	const { checks } = getConfig();
	const intervalMs = Math.max(10, checks.intervalSeconds) * 1000;

	void runChecks().catch((err) => console.error('[skinnystatus] check run failed', err));

	timer = setInterval(() => {
		void runChecks().catch((err) => console.error('[skinnystatus] check run failed', err));
	}, intervalMs);

	if (typeof timer === 'object' && 'unref' in timer) {
		timer.unref();
	}
}

export function stopChecker(): void {
	if (timer) clearInterval(timer);
	timer = null;
	started = false;
}
