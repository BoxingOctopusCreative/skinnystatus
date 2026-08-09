import type { RequestHandler } from './$types';
import { jsonWithCors, optionsCors } from '$lib/server/api-cors';
import {
	getStatusPageBySlug,
	getServiceViews,
	listIncidents,
	overallStatus
} from '$lib/server/db/queries';
import { pageInfoFromRow } from '$lib/publishing';
import { statusLabel } from '$lib/status';

export const OPTIONS: RequestHandler = async () => optionsCors();

export const GET: RequestHandler = async ({ params }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	const page = pageInfoFromRow(row);
	const views = await getServiceViews(page.id);
	const overall = await overallStatus(page.id, views);
	const [activeIncidents, recentIncidents] = await Promise.all([
		listIncidents(page.id, { activeOnly: true }),
		listIncidents(page.id, { limit: 20 })
	]);

	const services = views.map((item) => ({
		id: item.id,
		name: item.name,
		description: item.description,
		status: item.status,
		uptime90d: item.uptime90d,
		latestCheck: item.latestCheck
			? {
					ok: item.latestCheck.ok,
					latencyMs: item.latestCheck.latencyMs,
					checkedAt: item.latestCheck.checkedAt.toISOString()
				}
			: null
	}));

	return jsonWithCors({
		page: {
			slug: page.slug,
			name: page.name,
			description: page.description,
			theme: page.theme,
			checkDetailsEnabled: page.checkDetailsEnabled
		},
		overall,
		overallLabel: statusLabel(overall),
		services,
		activeIncidents: activeIncidents.map((i) => ({
			id: i.id,
			title: i.title,
			status: i.status,
			impact: i.impact,
			createdAt: i.createdAt.toISOString(),
			updatedAt: i.updatedAt.toISOString()
		})),
		recentIncidents: recentIncidents
			.filter((i) => i.status === 'resolved')
			.map((i) => ({
				id: i.id,
				title: i.title,
				status: i.status,
				impact: i.impact,
				resolvedAt: i.resolvedAt?.toISOString() ?? null,
				updatedAt: i.updatedAt.toISOString()
			})),
		updatedAt: new Date().toISOString()
	});
};
