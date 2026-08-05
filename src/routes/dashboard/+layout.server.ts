import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import { resolveCurrentTeam } from '$lib/server/dashboard-page';
import { db, user as userTable } from '$lib/server/db';
import { resolveImageUrl } from '$lib/server/r2';
import { listTeamsForUser } from '$lib/server/teams';

export const load: LayoutServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) {
		return { user: null, path: url.pathname, teams: [], team: null };
	}

	const pathname = url.pathname;
	const isLogin = pathname.startsWith('/dashboard/login');
	const isPreview = pathname.startsWith('/dashboard/preview');
	const isCreateTeam = pathname.startsWith('/dashboard/teams/new');

	const teams = await listTeamsForUser(locals.user.id);

	if (!isLogin && !isPreview && !isCreateTeam && teams.length === 0) {
		throw redirect(303, '/dashboard/teams/new');
	}

	let team: Awaited<ReturnType<typeof resolveCurrentTeam>>['team'] | null = null;
	let teamsForNav = teams;
	if (!isLogin && !isPreview && !isCreateTeam && teams.length > 0) {
		const resolved = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		team = resolved.team;
		teamsForNav = resolved.teams;
	}

	const [dbUser] = await db
		.select({ image: userTable.image })
		.from(userTable)
		.where(eq(userTable.id, locals.user.id))
		.limit(1);

	const imageUrl = await resolveImageUrl(dbUser?.image ?? locals.user.image ?? null);

	return {
		user: {
			id: locals.user.id,
			email: locals.user.email,
			name: locals.user.name,
			imageUrl
		},
		path: pathname,
		teams: teamsForNav.map((t) => ({ id: t.id, name: t.name })),
		team: team ? { id: team.id, name: team.name, role: team.role } : null
	};
};
