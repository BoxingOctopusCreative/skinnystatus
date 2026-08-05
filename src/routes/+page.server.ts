import { getConfig } from '$lib/server/config';
import { loadStatusBoard, requireStatusPage } from '$lib/server/status-board';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, request }) => {
	if (locals.statusPage?.publishMode === 'subdomain') {
		const page = requireStatusPage(locals.statusPage);
		return {
			mode: 'board' as const,
			...(await loadStatusBoard(page, request.headers.get('host') ?? ''))
		};
	}

	const config = getConfig();
	return {
		mode: 'landing' as const,
		site: config.site
	};
};
