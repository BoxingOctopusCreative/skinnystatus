import { describe, expect, it } from 'vitest';
import {
	buildCheckDayDetail,
	groupFailureRuns,
	MAX_FAILURE_RUNS,
	redactCheckDayDetail,
	stripTargetQuery,
	summarizeLatency,
	type CheckSample
} from './check-detail';

function sample(minute: number, overrides: Partial<CheckSample> = {}): CheckSample {
	const stamp = new Date(Date.UTC(2026, 6, 14, 0, minute, 0)).toISOString();
	return {
		checkedAt: stamp,
		ok: true,
		latencyMs: 120,
		statusCode: 200,
		error: null,
		...overrides
	};
}

function failure(minute: number, overrides: Partial<CheckSample> = {}): CheckSample {
	return sample(minute, {
		ok: false,
		statusCode: 503,
		error: 'Service Unavailable',
		...overrides
	});
}

describe('groupFailureRuns', () => {
	it('returns no runs for a clean day', () => {
		const { runs, truncated } = groupFailureRuns([sample(0), sample(1), sample(2)]);
		expect(runs).toEqual([]);
		expect(truncated).toBe(false);
	});

	it('collapses consecutive failures into one window', () => {
		const { runs } = groupFailureRuns([sample(0), failure(1), failure(2), failure(3), sample(4)]);
		expect(runs).toHaveLength(1);
		expect(runs[0].count).toBe(3);
		expect(runs[0].from).toBe(sample(1).checkedAt);
		expect(runs[0].to).toBe(sample(3).checkedAt);
	});

	it('splits runs separated by a passing check', () => {
		const { runs } = groupFailureRuns([failure(0), sample(1), failure(2), failure(3)]);
		expect(runs).toHaveLength(2);
		expect(runs[0].count).toBe(1);
		expect(runs[1].count).toBe(2);
	});

	it('reports the status code and error from the check that opened the run', () => {
		const { runs } = groupFailureRuns([
			failure(0, { statusCode: 500, error: 'Internal Server Error' }),
			failure(1, { statusCode: 502, error: 'Bad Gateway' })
		]);
		expect(runs).toHaveLength(1);
		expect(runs[0].statusCode).toBe(500);
		expect(runs[0].error).toBe('Internal Server Error');
	});

	it('keeps the most recent runs and flags truncation past the cap', () => {
		const samples: CheckSample[] = [];
		for (let i = 0; i < MAX_FAILURE_RUNS + 5; i++) {
			samples.push(failure(i * 2));
			samples.push(sample(i * 2 + 1));
		}
		const { runs, truncated } = groupFailureRuns(samples);
		expect(truncated).toBe(true);
		expect(runs).toHaveLength(MAX_FAILURE_RUNS);
		expect(runs[runs.length - 1].from).toBe(sample((MAX_FAILURE_RUNS + 4) * 2).checkedAt);
	});
});

describe('summarizeLatency', () => {
	it('ignores samples with no recorded latency', () => {
		const result = summarizeLatency([
			sample(0, { latencyMs: 100 }),
			sample(1, { latencyMs: null }),
			sample(2, { latencyMs: 300 })
		]);
		expect(result).toEqual({ min: 100, avg: 200, max: 300 });
	});

	it('returns null when nothing has latency', () => {
		expect(summarizeLatency([sample(0, { latencyMs: null })])).toBeNull();
	});
});

describe('buildCheckDayDetail', () => {
	const base = {
		serviceId: 'svc-1',
		serviceName: 'Checkout API',
		date: '2026-07-14',
		checkLabel: 'HTTP',
		checkTarget: 'https://checkout.internal/health',
		expectedStatus: 200
	};

	it('counts passes and failures and derives uptime', () => {
		const detail = buildCheckDayDetail({
			...base,
			samples: [sample(0), failure(1), sample(2), sample(3)]
		});
		expect(detail.total).toBe(4);
		expect(detail.ok).toBe(3);
		expect(detail.failed).toBe(1);
		expect(detail.uptime).toBe(0.75);
	});

	it('reports the last check of the day', () => {
		const detail = buildCheckDayDetail({
			...base,
			samples: [sample(0), failure(1)]
		});
		expect(detail.lastCheck?.checkedAt).toBe(failure(1).checkedAt);
		expect(detail.lastCheck?.ok).toBe(false);
	});

	it('leaves uptime null for a day with no checks', () => {
		const detail = buildCheckDayDetail({ ...base, samples: [] });
		expect(detail.uptime).toBeNull();
		expect(detail.lastCheck).toBeNull();
		expect(detail.latencyMs).toBeNull();
	});
});

describe('stripTargetQuery', () => {
	it('drops the query string that can carry an API key', () => {
		expect(stripTargetQuery('https://api.acme.com/v1/health?token=sk_live_9f3a')).toBe(
			'https://api.acme.com/v1/health'
		);
	});

	it('drops credentials embedded in the URL', () => {
		expect(stripTargetQuery('https://monitor:s3cret@api.acme.com/health')).toBe(
			'https://api.acme.com/health'
		);
	});

	it('drops the fragment', () => {
		expect(stripTargetQuery('http://api.acme.com/health#key=abc')).toBe(
			'http://api.acme.com/health'
		);
	});

	it('keeps the port and path', () => {
		expect(stripTargetQuery('http://api.acme.com:8443/v1/status?verbose=1')).toBe(
			'http://api.acme.com:8443/v1/status'
		);
	});

	it('leaves plain http targets untouched', () => {
		expect(stripTargetQuery('https://acme.com/health')).toBe('https://acme.com/health');
	});

	it('passes through targets that are not http URLs', () => {
		expect(stripTargetQuery('db.internal:5432')).toBe('db.internal:5432');
		expect(stripTargetQuery('A acme.com')).toBe('A acme.com');
		expect(stripTargetQuery('redis://cache.internal:6379')).toBe('redis://cache.internal:6379');
	});

	it('passes through null', () => {
		expect(stripTargetQuery(null)).toBeNull();
	});
});

describe('redactCheckDayDetail', () => {
	it('removes status codes, error text, the probe target, and the latest check', () => {
		const detail = buildCheckDayDetail({
			serviceId: 'svc-1',
			serviceName: 'Primary database',
			date: '2026-07-14',
			checkLabel: 'Postgres',
			checkTarget: 'db.internal:5432',
			expectedStatus: 200,
			samples: [sample(0), failure(1, { error: 'connect ECONNREFUSED 10.0.0.7:5432' })],
			latestCheck: failure(2, { error: 'connect ECONNREFUSED 10.0.0.7:5432' })
		});

		const safe = redactCheckDayDetail(detail);

		expect(safe.checkTarget).toBeNull();
		expect(safe.expectedStatus).toBeNull();
		expect(safe.latestCheck).toBeNull();
		expect(safe.lastCheck?.statusCode).toBeNull();
		expect(safe.lastCheck?.error).toBeNull();
		expect(safe.failureRuns[0].error).toBeNull();
		expect(safe.failureRuns[0].statusCode).toBeNull();
		expect(safe.includesTechnicalDetail).toBe(false);
		expect(JSON.stringify(safe)).not.toContain('10.0.0.7');
		expect(JSON.stringify(safe)).not.toContain('db.internal');
	});

	it('keeps the counts and timings that make the panel useful', () => {
		const detail = buildCheckDayDetail({
			serviceId: 'svc-1',
			serviceName: 'Checkout API',
			date: '2026-07-14',
			checkLabel: 'HTTP',
			checkTarget: 'https://checkout.internal/health',
			expectedStatus: 200,
			samples: [sample(0), failure(1), failure(2)]
		});

		const safe = redactCheckDayDetail(detail);

		expect(safe.checkLabel).toBe('HTTP');
		expect(safe.total).toBe(3);
		expect(safe.failed).toBe(2);
		expect(safe.latencyMs).toEqual(detail.latencyMs);
		expect(safe.failureRuns[0].count).toBe(2);
		expect(safe.failureRuns[0].from).toBe(failure(1).checkedAt);
	});
});
