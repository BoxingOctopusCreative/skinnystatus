import {
	isCheckType,
	type DbCheckConfig,
	type DnsCheckConfig,
	type RedisCheckConfig,
	type SslCheckConfig,
	type TcpCheckConfig
} from '$lib/checks';
import { decryptCheckConfig } from './config';
import { runDnsCheck } from './dns';
import { runHttpCheck } from './http';
import { runMysqlCheck } from './mysql';
import { runPostgresCheck } from './postgres';
import { runRedisCheck } from './redis';
import { runSslCheck } from './ssl';
import { runTcpCheck } from './tcp';
import type { CheckOutcome, ServiceCheckInput } from './types';
import { failOutcome } from './types';

export async function runServiceCheck(
	service: ServiceCheckInput,
	timeoutMs: number
): Promise<CheckOutcome> {
	const startedAt = Date.now();
	const type = service.checkType;

	if (!type || !isCheckType(type)) {
		return failOutcome(startedAt, 'No check type configured');
	}

	try {
		switch (type) {
			case 'http': {
				if (!service.checkUrl) {
					return failOutcome(startedAt, 'Missing check URL');
				}
				return runHttpCheck(service.checkUrl, service.expectedStatus, timeoutMs);
			}
			case 'tcp': {
				const cfg = decryptCheckConfig<TcpCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing TCP check config');
				return runTcpCheck(cfg, timeoutMs);
			}
			case 'dns': {
				const cfg = decryptCheckConfig<DnsCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing DNS check config');
				return runDnsCheck(cfg, timeoutMs);
			}
			case 'ssl': {
				const cfg = decryptCheckConfig<SslCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing SSL check config');
				return runSslCheck(cfg, timeoutMs);
			}
			case 'postgres': {
				const cfg = decryptCheckConfig<DbCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing Postgres check config');
				return runPostgresCheck(cfg, timeoutMs);
			}
			case 'mysql': {
				const cfg = decryptCheckConfig<DbCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing MySQL check config');
				return runMysqlCheck(cfg, timeoutMs);
			}
			case 'redis': {
				const cfg = decryptCheckConfig<RedisCheckConfig>(service.checkConfig);
				if (!cfg) return failOutcome(startedAt, 'Missing Redis check config');
				return runRedisCheck(cfg, timeoutMs);
			}
		}
	} catch (err) {
		return failOutcome(startedAt, err instanceof Error ? err.message : 'Check failed');
	}
}

export { decryptCheckConfig, parseCheckFieldsFromForm, toPublicCheckSettings, sslDaysRemaining } from './config';
