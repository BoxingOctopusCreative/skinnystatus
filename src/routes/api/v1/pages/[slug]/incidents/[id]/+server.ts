import type { RequestHandler } from './$types';
import { jsonWithCors, optionsCors } from '$lib/server/api-cors';
import {
	getStatusPageBySlug,
	getIncident,
	getIncidentUpdates,
	getIncidentServiceIds
} from '$lib/server/db/queries';

export const OPTIONS: RequestHandler = async () => optionsCors();

export const GET: RequestHandler = async ({ params }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	const incident = await getIncident(params.id, row.id);
	if (!incident) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	const [updates, serviceIds] = await Promise.all([
		getIncidentUpdates(incident.id),
		getIncidentServiceIds(incident.id)
	]);

	return jsonWithCors({
		incident: {
			id: incident.id,
			title: incident.title,
			status: incident.status,
			impact: incident.impact,
			createdAt: incident.createdAt.toISOString(),
			updatedAt: incident.updatedAt.toISOString(),
			resolvedAt: incident.resolvedAt?.toISOString() ?? null,
			serviceIds,
			updates: updates.map((u) => ({
				id: u.id,
				body: u.body,
				status: u.status,
				createdAt: u.createdAt.toISOString()
			}))
		}
	});
};
