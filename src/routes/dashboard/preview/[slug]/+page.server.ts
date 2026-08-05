import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getStatusPageBySlug, toPageInfo } from '$lib/server/db/queries';
import { getConfig } from '$lib/server/config';
import { userCanAccessPage } from '$lib/server/teams';

export const load: PageServerLoad = async ({ params, locals }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) error(404, 'Project not found');
	if (!locals.user) error(401, 'Unauthorized');
	const can = await userCanAccessPage(locals.user.id, row.id);
	if (!can) error(404, 'Project not found');

	const project = toPageInfo(row);
	const config = getConfig();

	return {
		project,
		apiBase: config.site.baseUrl.replace(/\/$/, '')
	};
};
