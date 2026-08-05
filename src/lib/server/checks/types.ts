import type { CheckType } from '$lib/checks';

export type CheckOutcome = {
	ok: boolean;
	latencyMs: number | null;
	statusCode: number | null;
	error: string | null;
};

export type ServiceCheckInput = {
	checkType: CheckType | null;
	checkUrl: string | null;
	expectedStatus: number;
	checkConfig: string | null;
};

export function failOutcome(startedAt: number, error: string): CheckOutcome {
	return {
		ok: false,
		latencyMs: Date.now() - startedAt,
		statusCode: null,
		error
	};
}

export function okOutcome(startedAt: number, statusCode: number | null = null): CheckOutcome {
	return {
		ok: true,
		latencyMs: Date.now() - startedAt,
		statusCode,
		error: null
	};
}
