import net from 'node:net';
import Redis from 'ioredis';
import type { RedisCheckConfig } from '$lib/checks';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

/** Unauthenticated: raw RESP PING (works when requirepass is off). */
export function runRedisPingRaw(
	config: Pick<RedisCheckConfig, 'host' | 'port'>,
	timeoutMs: number
): Promise<CheckOutcome> {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const socket = net.connect({ host: config.host, port: config.port });
		let settled = false;
		let buffer = '';

		const finish = (outcome: CheckOutcome) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(outcome);
		};

		socket.setTimeout(timeoutMs);
		socket.once('connect', () => {
			socket.write('*1\r\n$4\r\nPING\r\n');
		});
		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			if (buffer.includes('+PONG')) {
				finish(okOutcome(startedAt));
				return;
			}
			if (buffer.startsWith('-')) {
				const line = buffer.split('\r\n')[0] ?? buffer;
				finish(failOutcome(startedAt, line.slice(1) || 'Redis error'));
			}
		});
		socket.once('timeout', () => finish(failOutcome(startedAt, 'Redis ping timed out')));
		socket.once('error', (err) => finish(failOutcome(startedAt, err.message)));
	});
}

export async function runRedisCheck(
	config: RedisCheckConfig,
	timeoutMs: number
): Promise<CheckOutcome> {
	if (!config.authenticated) {
		return runRedisPingRaw(config, timeoutMs);
	}

	const startedAt = Date.now();
	const client = new Redis({
		host: config.host,
		port: config.port,
		username: config.username || undefined,
		password: config.password,
		connectTimeout: timeoutMs,
		maxRetriesPerRequest: 0,
		enableOfflineQueue: false,
		lazyConnect: true
	});

	try {
		await Promise.race([
			(async () => {
				await client.connect();
				const reply = await client.ping();
				if (reply !== 'PONG') {
					throw new Error(`Unexpected PING reply: ${reply}`);
				}
			})(),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Redis check timed out')), timeoutMs)
			)
		]);
		return okOutcome(startedAt);
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'Redis check failed');
	} finally {
		client.disconnect();
	}
}
