import { isRedirect, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { acceptTeamInvite, findValidInviteByToken } from '$lib/server/teams';

export const load: PageServerLoad = async ({ params, locals }) => {
	const token = params.token?.trim() ?? '';
	const invite = token ? await findValidInviteByToken(token) : null;

	if (!invite) {
		return { invalid: true as const, teamName: null as string | null, acceptError: null as string | null };
	}

	if (locals.user) {
		try {
			const { teamId } = await acceptTeamInvite(token, locals.user.id, locals.user.email);
			throw redirect(303, `/dashboard?team=${teamId}`);
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[skinnystatus] acceptTeamInvite failed', err);
			return {
				invalid: false as const,
				teamName: invite.teamName,
				acceptError: err instanceof Error ? err.message : 'Could not accept invite'
			};
		}
	}

	const redirectTo = `/invite/${token}`;
	throw redirect(303, `/dashboard/login?redirectTo=${encodeURIComponent(redirectTo)}`);
};
