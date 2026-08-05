import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Teams list removed; switcher + Settings cover team management. */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');
	throw redirect(303, '/dashboard');
};
