/** Per-day check detail shown when a visitor clicks an uptime bar. Safe for client + server. */

/** A single recorded check, serialized for the wire. */
export type CheckSample = {
	checkedAt: string;
	ok: boolean;
	latencyMs: number | null;
	statusCode: number | null;
	error: string | null;
};

/** Consecutive failing checks collapsed into one window. */
export type CheckFailureRun = {
	from: string;
	to: string;
	count: number;
	statusCode: number | null;
	error: string | null;
};

export type CheckLatencySummary = {
	min: number;
	avg: number;
	max: number;
};

export type CheckDayDetail = {
	serviceId: string;
	serviceName: string;
	date: string;
	/** Human name of the probe, e.g. `HTTP`. Null when no automated check runs. */
	checkLabel: string | null;
	/** Concrete probe target. Null when unset or withheld from visitors. */
	checkTarget: string | null;
	expectedStatus: number | null;
	total: number;
	ok: number;
	failed: number;
	uptime: number | null;
	latencyMs: CheckLatencySummary | null;
	failureRuns: CheckFailureRun[];
	/** True when failures were capped at `MAX_FAILURE_RUNS`. */
	failureRunsTruncated: boolean;
	/** Most recent check inside this day. */
	lastCheck: CheckSample | null;
	/** Service's most recent check overall. Only populated for operator views. */
	latestCheck: CheckSample | null;
	/** False when status codes, error text, and the probe target were withheld. */
	includesTechnicalDetail: boolean;
};

/**
 * A day of one-minute checks can hold hundreds of separate outages. Cap the list
 * so a bad day can't return a payload nobody will read.
 */
export const MAX_FAILURE_RUNS = 25;

/**
 * Collapse runs of consecutive failures into windows. Expects samples sorted
 * oldest first. The status code and error reported are the ones from the check
 * that opened the run.
 */
export function groupFailureRuns(samples: CheckSample[]): {
	runs: CheckFailureRun[];
	truncated: boolean;
} {
	const runs: CheckFailureRun[] = [];
	let current: CheckFailureRun | null = null;

	for (const sample of samples) {
		if (sample.ok) {
			current = null;
			continue;
		}
		if (current) {
			current.to = sample.checkedAt;
			current.count += 1;
			continue;
		}
		current = {
			from: sample.checkedAt,
			to: sample.checkedAt,
			count: 1,
			statusCode: sample.statusCode,
			error: sample.error
		};
		runs.push(current);
	}

	if (runs.length <= MAX_FAILURE_RUNS) return { runs, truncated: false };
	return { runs: runs.slice(-MAX_FAILURE_RUNS), truncated: true };
}

export function summarizeLatency(samples: CheckSample[]): CheckLatencySummary | null {
	const values = samples.map((s) => s.latencyMs).filter((v): v is number => typeof v === 'number');
	if (values.length === 0) return null;
	let min = values[0];
	let max = values[0];
	let sum = 0;
	for (const value of values) {
		if (value < min) min = value;
		if (value > max) max = value;
		sum += value;
	}
	return { min, max, avg: Math.round(sum / values.length) };
}

/**
 * Build the day payload from that day's checks, sorted oldest first.
 * Pure so it can be tested without a database.
 */
export function buildCheckDayDetail(input: {
	serviceId: string;
	serviceName: string;
	date: string;
	checkLabel: string | null;
	checkTarget: string | null;
	expectedStatus: number | null;
	samples: CheckSample[];
	latestCheck?: CheckSample | null;
}): CheckDayDetail {
	const { samples } = input;
	const okCount = samples.reduce((total, s) => total + (s.ok ? 1 : 0), 0);
	const { runs, truncated } = groupFailureRuns(samples);

	return {
		serviceId: input.serviceId,
		serviceName: input.serviceName,
		date: input.date,
		checkLabel: input.checkLabel,
		checkTarget: input.checkTarget,
		expectedStatus: input.expectedStatus,
		total: samples.length,
		ok: okCount,
		failed: samples.length - okCount,
		uptime: samples.length === 0 ? null : okCount / samples.length,
		latencyMs: summarizeLatency(samples),
		failureRuns: runs,
		failureRunsTruncated: truncated,
		lastCheck: samples.length === 0 ? null : samples[samples.length - 1],
		latestCheck: input.latestCheck ?? null,
		includesTechnicalDetail: true
	};
}

/**
 * Visitor-safe form of a probe target: scheme, host, and path only. Query
 * strings and URL userinfo routinely carry API keys, so a page that opts into
 * technical detail must not publish them. Targets that are not http(s) URLs
 * (DNS records, `host:port` pairs) pass through unchanged.
 */
export function stripTargetQuery(target: string | null): string | null {
	if (!target) return target;

	let url: URL;
	try {
		url = new URL(target);
	} catch {
		return target;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return target;

	return `${url.protocol}//${url.host}${url.pathname}`;
}

/**
 * Strip everything that can expose internals to a visitor: status codes, raw
 * error strings from the probe, and the probe target itself. Database and TCP
 * checks put connection errors straight into `error`, so those strings can carry
 * internal hostnames and ports.
 */
export function redactCheckDayDetail(detail: CheckDayDetail): CheckDayDetail {
	const stripSample = (sample: CheckSample | null): CheckSample | null =>
		sample === null ? null : { ...sample, statusCode: null, error: null };

	return {
		...detail,
		checkTarget: null,
		expectedStatus: null,
		failureRuns: detail.failureRuns.map((run) => ({
			...run,
			statusCode: null,
			error: null
		})),
		lastCheck: stripSample(detail.lastCheck),
		latestCheck: null,
		includesTechnicalDetail: false
	};
}
