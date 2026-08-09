/** Wire types for the check detail panel. Mirrors `src/lib/check-detail.ts` in the app. */

export type CheckSample = {
	checkedAt: string;
	ok: boolean;
	latencyMs: number | null;
	statusCode: number | null;
	error: string | null;
};

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
	checkLabel: string | null;
	checkTarget: string | null;
	expectedStatus: number | null;
	total: number;
	ok: number;
	failed: number;
	uptime: number | null;
	latencyMs: CheckLatencySummary | null;
	failureRuns: CheckFailureRun[];
	failureRunsTruncated: boolean;
	lastCheck: CheckSample | null;
	latestCheck: CheckSample | null;
	includesTechnicalDetail: boolean;
};
