import net from 'node:net';
import mysql from 'mysql2/promise';
import type { DbCheckConfig } from '$lib/checks';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

/** Read MySQL handshake greeting without authenticating. */
function runMysqlGreetingCheck(
	config: Pick<DbCheckConfig, 'host' | 'port'>,
	timeoutMs: number
): Promise<CheckOutcome> {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const socket = net.connect({ host: config.host, port: config.port });
		let settled = false;
		const chunks: Buffer[] = [];

		const finish = (outcome: CheckOutcome) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(outcome);
		};

		socket.setTimeout(timeoutMs);
		socket.on('data', (chunk) => {
			chunks.push(chunk);
			const buf = Buffer.concat(chunks);
			// MySQL packet: 3-byte length + 1-byte seq + payload; protocol version is first payload byte
			if (buf.length >= 5) {
				const protocol = buf[4];
				if (protocol === 0x0a) {
					finish(okOutcome(startedAt));
				} else {
					finish(failOutcome(startedAt, `Unexpected MySQL protocol version ${protocol}`));
				}
			}
		});
		socket.once('timeout', () => finish(failOutcome(startedAt, 'MySQL greeting timed out')));
		socket.once('error', (err) => finish(failOutcome(startedAt, err.message)));
	});
}

export async function runMysqlCheck(
	config: DbCheckConfig,
	timeoutMs: number
): Promise<CheckOutcome> {
	if (!config.authenticated) {
		return runMysqlGreetingCheck(config, timeoutMs);
	}

	const startedAt = Date.now();
	let connection: mysql.Connection | null = null;
	try {
		connection = await mysql.createConnection({
			host: config.host,
			port: config.port,
			user: config.user,
			password: config.password,
			database: config.database || undefined,
			ssl: config.ssl ? {} : undefined,
			connectTimeout: timeoutMs
		});
		await Promise.race([
			connection.query('SELECT 1'),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('MySQL check timed out')), timeoutMs)
			)
		]);
		return okOutcome(startedAt);
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'MySQL check failed');
	} finally {
		if (connection) {
			await connection.end().catch(() => undefined);
		}
	}
}
