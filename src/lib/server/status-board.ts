import {
	getServiceViews,
	listIncidents,
	overallStatus,
	getIncident,
	getIncidentUpdates,
	getIncidentServiceIds,
	listServices,
	dailyUptimeBuckets,
	type IncidentRow,
	type StatusPageRow
} from '$lib/server/db/queries';
import { publicPathPrefix } from '$lib/server/publishing';
import { statusLabel } from '$lib/status';
import type { StatusPageInfo } from '$lib/publishing';
import { error } from '@sveltejs/kit';

/**
 * Everything returned from these loaders is serialized into the page for any
 * visitor to read, so each helper narrows its rows to the fields the status
 * page actually renders. Check URLs, probe targets, credentials metadata, and
 * raw check errors stay on the server.
 */
export function publicPageFields(page: StatusPageInfo) {
	return {
		name: page.name,
		description: page.description,
		slug: page.slug,
		checkDetailsEnabled: page.checkDetailsEnabled
	};
}

export function publicIncidentFields(row: IncidentRow) {
	return {
		id: row.id,
		title: row.title,
		status: row.status,
		impact: row.impact,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		resolvedAt: row.resolvedAt
	};
}

export async function loadStatusBoard(page: StatusPageInfo, requestHost: string) {
	const [views, uptimeByService, activeIncidents, recentIncidents] = await Promise.all([
		getServiceViews(page.id),
		dailyUptimeBuckets(page.id, 90),
		listIncidents(page.id, { activeOnly: true }),
		listIncidents(page.id, { limit: 10 })
	]);
	const overall = await overallStatus(page.id, views);
	const basePath = publicPathPrefix(page, requestHost);

	return {
		page: publicPageFields(page),
		basePath,
		overall,
		overallLabel: statusLabel(overall),
		services: views.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			status: item.status,
			uptime90d: item.uptime90d
		})),
		uptimeByService,
		activeIncidents: activeIncidents.map(publicIncidentFields),
		recentIncidents: recentIncidents
			.filter((i) => i.status === 'resolved')
			.slice(0, 5)
			.map(publicIncidentFields)
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

	const affected = services
		.filter((c) => serviceIds.includes(c.id))
		.map((c) => ({ id: c.id, name: c.name }));
	const basePath = publicPathPrefix(page, requestHost);

	return {
		page: publicPageFields(page),
		basePath,
		incident: publicIncidentFields(incident),
		updates: updates.map((u) => ({
			id: u.id,
			body: u.body,
			status: u.status,
			createdAt: u.createdAt
		})),
		affected
	};
}

export function requireStatusPage(page: StatusPageInfo | null | undefined): StatusPageInfo {
	if (!page) error(404, 'Status page not found');
	return page;
}

export type { StatusPageRow };
