import { loadIncidentDetail, requireStatusPage } from '$lib/server/status-board';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, request }) => {
	if (locals.statusPage?.publishMode !== 'subdomain') {
		error(404, 'Not found');
	}
	const page = requireStatusPage(locals.statusPage);
	return loadIncidentDetail(page, params.id, request.headers.get('host') ?? '');
};
