import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** @deprecated Use /dashboard/projects */
export const load: PageServerLoad = async () => {
	throw redirect(308, '/dashboard/projects');
};
