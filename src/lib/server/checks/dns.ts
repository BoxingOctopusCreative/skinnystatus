import dns from 'node:dns/promises';
import type { DnsCheckConfig } from '$lib/checks';
import type { CheckOutcome } from './types';
import { failOutcome, okOutcome } from './types';

export async function runDnsCheck(config: DnsCheckConfig, timeoutMs: number): Promise<CheckOutcome> {
	const startedAt = Date.now();
	try {
		const records = await Promise.race([
			resolveRecords(config),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('DNS lookup timed out')), timeoutMs)
			)
		]);

		if (records.length === 0) {
			return failOutcome(startedAt, 'No records returned');
		}

		if (config.expected && config.expected.length > 0) {
			const normalized = new Set(records.map((r) => r.toLowerCase()));
			const missing = config.expected.filter((e) => !normalized.has(e.toLowerCase()));
			if (missing.length > 0) {
				return failOutcome(
					startedAt,
					`Missing expected record(s): ${missing.join(', ')} (got ${records.join(', ')})`
				);
			}
		}

		return okOutcome(startedAt);
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'DNS check failed');
	}
}

async function resolveRecords(config: DnsCheckConfig): Promise<string[]> {
	switch (config.recordType) {
		case 'A': {
			return dns.resolve4(config.hostname);
		}
		case 'AAAA': {
			return dns.resolve6(config.hostname);
		}
		case 'CNAME': {
			return dns.resolveCname(config.hostname);
		}
		case 'MX': {
			const addrs = await dns.resolveMx(config.hostname);
			return addrs.map((r) => `${r.priority} ${r.exchange}`);
		}
		case 'TXT': {
			const addrs = await dns.resolveTxt(config.hostname);
			return addrs.map((chunks) => chunks.join(''));
		}
	}
}
