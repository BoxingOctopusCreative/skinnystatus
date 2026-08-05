import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveCurrentTeam } from '$lib/server/dashboard-page';
import {
	listStatusPagesForTeam,
	roleAtLeast,
	userCanManageTeam
} from '$lib/server/teams';
import { toPageInfo } from '$lib/server/db/queries';
import { canonicalPageUrl, publishUrlHint } from '$lib/server/publishing';
import { parsePageTheme } from '$lib/theme-config';
import { resolveImageUrl } from '$lib/server/r2';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const { team, teams } = await resolveCurrentTeam(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});

	const canManage = await userCanManageTeam(team.id, locals.user.id);
	const bannerUrl = await resolveImageUrl(team.bannerImage);
	const pages = await listStatusPagesForTeam(team.id);

	const projects = pages
		.filter((p) => canManage || p.deletedAt == null)
		.map((p) => {
			const info = toPageInfo(p);
			return {
				...info,
				theme: parsePageTheme(p.themeJson),
				url: info.deployUrl ?? canonicalPageUrl(info),
				urlHint: publishUrlHint(info),
				published: p.published,
				deletedAt: p.deletedAt
			};
		});

	return {
		team,
		teams,
		bannerUrl,
		canManage,
		canManageLifecycle: roleAtLeast(team.role, 'admin'),
		projects
	};
};
