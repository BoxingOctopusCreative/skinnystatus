import {
	getServiceViews,
	listIncidents,
	overallStatus,
	getIncident,
	getIncidentUpdates,
	getIncidentServiceIds,
	listServices,
	dailyUptimeBuckets,
	type StatusPageRow
} from '$lib/server/db/queries';
import { publicPathPrefix } from '$lib/server/publishing';
import { statusLabel } from '$lib/status';
import type { StatusPageInfo } from '$lib/publishing';
import { error } from '@sveltejs/kit';

export async function loadStatusBoard(page: StatusPageInfo, requestHost: string) {
	const [services, uptimeByService, activeIncidents, recentIncidents] = await Promise.all([
		getServiceViews(page.id),
		dailyUptimeBuckets(page.id, 90),
		listIncidents(page.id, { activeOnly: true }),
		listIncidents(page.id, { limit: 10 })
	]);
	const overall = await overallStatus(page.id, services);
	const basePath = publicPathPrefix(page, requestHost);

	return {
		page,
		basePath,
		overall,
		overallLabel: statusLabel(overall),
		services,
		uptimeByService,
		activeIncidents,
		recentIncidents: recentIncidents.filter((i) => i.status === 'resolved').slice(0, 5)
	};
}

export async function loadIncidentDetail(
	page: StatusPageInfo,
	incidentId: string,
	requestHost: string
) {
	const incident = await getIncident(incidentId, page.id);
	if (!incident) error(404, 'Incident not found');

	const [updates, serviceIds, services] = await Promise.all([
		getIncidentUpdates(incident.id),
		getIncidentServiceIds(incident.id),
		listServices(page.id)
	]);

	const affected = services.filter((c) => serviceIds.includes(c.id));
	const basePath = publicPathPrefix(page, requestHost);

	return {
		page,
		basePath,
		incident,
		updates,
		affected
	};
}

export function requireStatusPage(page: StatusPageInfo | null | undefined): StatusPageInfo {
	if (!page) error(404, 'Status page not found');
	return page;
}

export type { StatusPageRow };
