import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkDayDetail, getStatusPageBySlug } from '$lib/server/db/queries';
import { userCanAccessPage } from '$lib/server/teams';

/**
 * Operator view of a single day's checks. Team members always get the full
 * detail, including status codes, error strings, and the probe target, whatever
 * the project's visitor-facing settings say.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) error(404, 'Project not found');
	if (!locals.user) error(401, 'Unauthorized');
	const can = await userCanAccessPage(locals.user.id, row.id);
	if (!can) error(404, 'Project not found');

	const detail = await checkDayDetail(row.id, params.serviceId, params.date, {
		includeTechnicalDetail: true,
		includeLatestCheck: true,
		includeTargetQuery: true
	});
	if (!detail) error(404, 'No check detail for that day');

	return json({ detail });
};
