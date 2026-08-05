import { error, redirect } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import {
	ensureDefaultStatusPage,
	adoptLegacyProjectsIfSoleUser
} from '$lib/server/db/queries';
import {
	getAccessibleStatusPage,
	getTeamById,
	listActiveStatusPagesForTeam,
	listTeamsForUser,
	userCanAccessPage,
	userCanManagePageLifecycle,
	userCanMutatePage,
	type TeamRow
} from '$lib/server/teams';
import type { TeamRole } from '$lib/server/db/schema.pg';

export const TEAM_COOKIE = 'ss_team';

export async function resolveCurrentTeam(
	url: URL,
	userId: string,
	cookies: Cookies,
	_opts?: { email?: string; name?: string }
): Promise<{
	team: TeamRow & { role: TeamRole; memberCount: number };
	teams: Array<TeamRow & { role: TeamRole; memberCount: number }>;
}> {
	await adoptLegacyProjectsIfSoleUser(userId);

	const teams = await listTeamsForUser(userId);
	if (teams.length === 0) {
		throw redirect(303, '/dashboard/teams/new');
	}

	const requested = url.searchParams.get('team') ?? cookies.get(TEAM_COOKIE) ?? null;
	const match = teams.find((t) => t.id === requested) ?? teams[0];
	cookies.set(TEAM_COOKIE, match.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: 60 * 60 * 24 * 365
	});

	return { team: match, teams };
}

export async function resolveAdminPageId(
	url: URL,
	userId: string,
	cookies: Cookies,
	opts?: { email?: string; name?: string }
): Promise<{
	pageId: string;
	pages: Awaited<ReturnType<typeof listActiveStatusPagesForTeam>>;
	team: TeamRow & { role: TeamRole; memberCount: number };
	teams: Array<TeamRow & { role: TeamRole; memberCount: number }>;
}> {
	const { team, teams } = await resolveCurrentTeam(url, userId, cookies, opts);
	await ensureDefaultStatusPage(userId, {
		email: opts?.email,
		name: opts?.name,
		teamId: team.id
	});
	const pages = await listActiveStatusPagesForTeam(team.id);
	const requested = url.searchParams.get('page');
	const match = pages.find((p) => p.id === requested) ?? pages[0];
	if (!match) error(500, 'No projects available');
	return { pageId: match.id, pages, team, teams };
}

export async function requireOwnedPage(pageId: string, ownerId: string) {
	const can = await userCanManagePageLifecycle(ownerId, pageId);
	if (!can) error(404, 'Project not found');
	const page = await getAccessibleStatusPage(pageId, ownerId);
	if (!page) error(404, 'Project not found');
	return page;
}

/** Page the user can view/edit via team membership. */
export async function requireAccessiblePage(pageId: string, userId: string) {
	const can = await userCanAccessPage(userId, pageId);
	if (!can) error(404, 'Project not found');
	const page = await getAccessibleStatusPage(pageId, userId);
	if (!page) error(404, 'Project not found');
	return page;
}

/** Page the user can mutate (same as access for day-to-day ops). */
export async function requireMutablePage(pageId: string, userId: string) {
	const can = await userCanMutatePage(userId, pageId);
	if (!can) error(404, 'Project not found');
	const page = await getAccessibleStatusPage(pageId, userId);
	if (!page) error(404, 'Project not found');
	return page;
}

export async function requireTeamForUser(teamId: string, userId: string): Promise<TeamRow> {
	const teams = await listTeamsForUser(userId);
	const match = teams.find((t) => t.id === teamId);
	if (!match) error(404, 'Team not found');
	const row = await getTeamById(teamId);
	if (!row) error(404, 'Team not found');
	return row;
}
