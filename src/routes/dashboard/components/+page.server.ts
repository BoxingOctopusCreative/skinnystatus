import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Old /dashboard/components URL → /dashboard/services */
export const load: PageServerLoad = async ({ url }) => {
	const dest = new URL(url);
	dest.pathname = '/dashboard/services';
	throw redirect(308, `${dest.pathname}${dest.search}`);
};
