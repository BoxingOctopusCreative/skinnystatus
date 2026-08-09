import type { RequestHandler } from './$types';
import { jsonWithCors, optionsCors } from '$lib/server/api-cors';
import { checkDayDetail, getStatusPageBySlug } from '$lib/server/db/queries';

export const OPTIONS: RequestHandler = async () => optionsCors();

export const GET: RequestHandler = async ({ params }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) return jsonWithCors({ error: 'Not found' }, { status: 404 });
	if (!row.checkDetailsEnabled) {
		return jsonWithCors({ error: 'Check details are not enabled for this page' }, { status: 404 });
	}

	const detail = await checkDayDetail(row.id, params.serviceId, params.date, {
		includeTechnicalDetail: row.checkDetailsIncludeErrors,
		includeLatestCheck: false,
		includeTargetQuery: false
	});
	if (!detail) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	return jsonWithCors({ detail });
};
