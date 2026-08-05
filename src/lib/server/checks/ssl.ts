import tls from 'node:tls';
import type { SslCheckConfig } from '$lib/checks';
import { sslDaysRemaining } from './config';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

export function runSslCheck(config: SslCheckConfig, timeoutMs: number): Promise<CheckOutcome> {
	const startedAt = Date.now();
	return new Promise((resolve) => {
		const socket = tls.connect({
			host: config.host,
			port: config.port,
			servername: config.host,
			rejectUnauthorized: false
		});
		let settled = false;

		const finish = (outcome: CheckOutcome) => {
			if (settled) return;
			settled = true;
			socket.destroy();
			resolve(outcome);
		};

		socket.setTimeout(timeoutMs);
		socket.once('secureConnect', () => {
			const cert = socket.getPeerCertificate();
			if (!cert || !cert.valid_to) {
				finish(failOutcome(startedAt, 'No peer certificate'));
				return;
			}
			const notAfter = new Date(cert.valid_to);
			if (Number.isNaN(notAfter.getTime())) {
				finish(failOutcome(startedAt, 'Invalid certificate expiry'));
				return;
			}
			const days = sslDaysRemaining(notAfter);
			if (days < config.minDaysRemaining) {
				finish(
					failOutcome(
						startedAt,
						`Certificate expires in ${days.toFixed(1)} days (minimum ${config.minDaysRemaining})`
					)
				);
				return;
			}
			finish(okOutcome(startedAt));
		});
		socket.once('timeout', () => finish(failOutcome(startedAt, 'TLS connection timed out')));
		socket.once('error', (err) => finish(failOutcome(startedAt, err.message)));
	});
}
