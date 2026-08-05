export const SERVICE_STATUSES = [
	'operational',
	'degraded',
	'partial_outage',
	'major_outage',
	'maintenance'
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const INCIDENT_STATUSES = [
	'investigating',
	'identified',
	'monitoring',
	'resolved'
] as const;

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_IMPACTS = ['none', 'minor', 'major', 'critical'] as const;

export type IncidentImpact = (typeof INCIDENT_IMPACTS)[number];

const STATUS_RANK: Record<ServiceStatus, number> = {
	operational: 0,
	maintenance: 1,
	degraded: 2,
	partial_outage: 3,
	major_outage: 4
};

export function worstStatus(statuses: ServiceStatus[]): ServiceStatus {
	if (statuses.length === 0) return 'operational';
	return statuses.reduce((worst, current) =>
		STATUS_RANK[current] > STATUS_RANK[worst] ? current : worst
	);
}

export function statusLabel(status: ServiceStatus): string {
	switch (status) {
		case 'operational':
			return 'All systems operational';
		case 'degraded':
			return 'Degraded performance';
		case 'partial_outage':
			return 'Partial outage';
		case 'major_outage':
			return 'Major outage';
		case 'maintenance':
			return 'Under maintenance';
	}
}

export function deriveCheckStatus(
	ok: boolean,
	latencyMs: number | null,
	degradedLatencyMs: number
): ServiceStatus {
	if (!ok) return 'major_outage';
	if (latencyMs !== null && latencyMs >= degradedLatencyMs) return 'degraded';
	return 'operational';
}

export function resolveServiceStatus(input: {
	manualStatus: ServiceStatus | null;
	checkType: string | null;
	checkUrl: string | null;
	latestOk: boolean | null;
	latestLatencyMs: number | null;
	degradedLatencyMs: number;
}): ServiceStatus {
	if (input.manualStatus) return input.manualStatus;
	const monitored = Boolean(input.checkType) || Boolean(input.checkUrl);
	if (monitored && input.latestOk !== null) {
		return deriveCheckStatus(input.latestOk, input.latestLatencyMs, input.degradedLatencyMs);
	}
	return 'operational';
}
