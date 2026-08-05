import postgres from 'postgres';
import type { DbCheckConfig } from '$lib/checks';
import { runTcpCheck } from './tcp';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

export async function runPostgresCheck(
	config: DbCheckConfig,
	timeoutMs: number
): Promise<CheckOutcome> {
	if (!config.authenticated) {
		return runTcpCheck({ host: config.host, port: config.port }, timeoutMs);
	}

	const startedAt = Date.now();
	const sql = postgres({
		host: config.host,
		port: config.port,
		database: config.database || 'postgres',
		username: config.user,
		password: config.password,
		ssl: config.ssl ? 'require' : false,
		connect_timeout: Math.max(1, Math.ceil(timeoutMs / 1000)),
		max: 1,
		idle_timeout: 1,
		max_lifetime: 5
	});

	try {
		await Promise.race([
			sql`SELECT 1`,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Postgres check timed out')), timeoutMs)
			)
		]);
		return okOutcome(startedAt);
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'Postgres check failed');
	} finally {
		await sql.end({ timeout: 1 }).catch(() => undefined);
	}
}
