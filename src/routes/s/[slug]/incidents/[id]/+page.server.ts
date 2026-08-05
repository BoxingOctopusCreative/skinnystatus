import { error } from '@sveltejs/kit';
import { loadIncidentDetail, requireStatusPage } from '$lib/server/status-board';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, request }) => {
	const page = requireStatusPage(locals.statusPage);
	if (page.publishMode !== 'path' || page.slug !== params.slug) {
		error(404, 'Status page not found');
	}
	return loadIncidentDetail(page, params.id, request.headers.get('host') ?? '');
};
