import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { isLimitError } from '$lib/server/billing/limits';
import { ensureDefaultStatusPage } from '$lib/server/db/queries';
import { TEAM_COOKIE } from '$lib/server/dashboard-page';
import { createTeam, listTeamsForUser } from '$lib/server/teams';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const teams = await listTeamsForUser(locals.user.id);

	return {
		email: locals.user.email,
		hasTeams: teams.length > 0,
		suggestedName:
			teams.length === 0
				? locals.user.name?.trim() ||
					locals.user.email?.split('@')[0]?.trim() ||
					'My team'
				: ''
	};
};

export const actions: Actions = {
	default: async ({ request, locals, cookies, url }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { message: 'Team name is required' });

		try {
			const existingBefore = await listTeamsForUser(locals.user.id);
			const created = await createTeam(locals.user.id, name);
			if (existingBefore.length === 0) {
				await ensureDefaultStatusPage(locals.user.id, {
					email: locals.user.email,
					name: locals.user.name,
					teamId: created.id
				});
			}
			cookies.set(TEAM_COOKIE, created.id, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: url.protocol === 'https:',
				maxAge: 60 * 60 * 24 * 365
			});
			throw redirect(303, `/dashboard/settings?team=${created.id}`);
		} catch (err) {
			if (isRedirect(err)) throw err;
			if (isLimitError(err)) {
				return fail(403, { message: err.message, upgrade: true });
			}
			console.error('[skinnystatus] create team wizard failed', err);
			return fail(500, { message: 'Could not create team' });
		}
	}
};
