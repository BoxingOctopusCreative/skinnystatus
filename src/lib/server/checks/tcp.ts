import net from 'node:net';
import type { TcpCheckConfig } from '$lib/checks';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

export function runTcpCheck(config: TcpCheckConfig, timeoutMs: number): Promise<CheckOutcome> {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const socket = net.connect({ host: config.host, port: config.port });
		let settled = false;

		const finish = (outcome: CheckOutcome) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(outcome);
		};

		socket.setTimeout(timeoutMs);
		socket.once('connect', () => finish(okOutcome(startedAt)));
		socket.once('timeout', () => finish(failOutcome(startedAt, 'Connection timed out')));
		socket.once('error', (err) => finish(failOutcome(startedAt, err.message)));
	});
}
