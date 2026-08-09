import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { assertCanCreateStatusPage, isLimitError } from '$lib/server/billing/limits';
import { db, statusPage } from '$lib/server/db';
import { isPublishMode, listServices, toPageInfo } from '$lib/server/db/queries';
import { toPublicCheckSettings } from '$lib/server/checks';
import { canonicalPageUrl, publishUrlHint } from '$lib/server/publishing';
import {
	HOST_PROVIDERS,
	isHostProvider,
	normalizePublishBaseDomain,
	normalizePublishPathPrefix,
	PUBLISH_MODES,
	slugValidationMessage
} from '$lib/publishing';
import type { PublicCheckSettings } from '$lib/checks';
import {
	serializePageTheme,
	themeFromForm,
	parsePageTheme,
	DEFAULT_PAGE_THEME
} from '$lib/theme-config';
import { deployProject } from '$lib/server/deploy';
import { providerReadyMap } from '$lib/server/host-credentials';
import { resolveCurrentTeam } from '$lib/server/dashboard-page';
import { PAGE_GRACE_DAYS } from '$lib/server/account-lifecycle';
import {
	getAccessibleStatusPage,
	listStatusPagesForTeam,
	roleAtLeast,
	userCanManagePageLifecycle,
	userCanMutatePage
} from '$lib/server/teams';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const { team, teams } = await resolveCurrentTeam(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});

	const pages = await listStatusPagesForTeam(team.id);
	const canManageLifecycle = roleAtLeast(team.role, 'admin');

	const projects = pages
		.filter((p) => canManageLifecycle || p.deletedAt == null)
		.map((p) => {
			const info = toPageInfo(p);
			return {
				...info,
				theme: parsePageTheme(p.themeJson),
				url: info.deployUrl ?? canonicalPageUrl(info),
				urlHint: publishUrlHint(info),
				published: p.published,
				deletedAt: p.deletedAt,
				undeleteExpiresAt: p.deletedAt
					? new Date(p.deletedAt.getTime() + PAGE_GRACE_DAYS * MS_PER_DAY)
					: null,
				canManageLifecycle
			};
		});

	const servicesByProjectId: Record<
		string,
		Array<{
			id: string;
			name: string;
			checkType: string | null;
			checkUrl: string | null;
			expectedStatus: number;
			manualStatus: string | null;
			checkSettings: PublicCheckSettings | null;
		}>
	> = {};
	await Promise.all(
		projects.map(async (project) => {
			const services = await listServices(project.id);
			servicesByProjectId[project.id] = services.map((c) => ({
				id: c.id,
				name: c.name,
				checkType: c.checkType,
				checkUrl: c.checkUrl,
				expectedStatus: c.expectedStatus,
				manualStatus: c.manualStatus,
				checkSettings: toPublicCheckSettings(c.checkType, c.checkConfig)
			}));
		})
	);

	return {
		team,
		teams,
		projects,
		servicesByProjectId,
		canManageLifecycle,
		modes: PUBLISH_MODES,
		providers: HOST_PROVIDERS,
		defaultTheme: DEFAULT_PAGE_THEME,
		providerReady: await providerReadyMap(team.id)
	};
};

export const actions: Actions = {
	create: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!roleAtLeast(team.role, 'admin')) {
			return fail(403, { message: 'Only team owners and admins can create projects' });
		}

		const form = await request.formData();
		const name = form.get('name')?.toString().trim() ?? '';
		const slug = (form.get('slug')?.toString().trim() ?? '').toLowerCase();
		const description = form.get('description')?.toString().trim() || null;
		const publishMode = form.get('publishMode')?.toString() ?? 'path';
		const hostProvider = form.get('hostProvider')?.toString() ?? 'vercel';
		const theme = themeFromForm(form);

		let publishBaseDomain: string | null = null;
		let publishPathPrefix = 's';
		try {
			publishBaseDomain = normalizePublishBaseDomain(
				form.get('publishBaseDomain')?.toString() ?? ''
			);
			publishPathPrefix = normalizePublishPathPrefix(
				form.get('publishPathPrefix')?.toString() ?? 's'
			);
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Invalid publishing settings'
			});
		}

		if (!name) return fail(400, { message: 'Name is required' });
		{
			const slugError = slugValidationMessage(slug);
			if (slugError) return fail(400, { message: slugError });
		}
		if (!isPublishMode(publishMode)) return fail(400, { message: 'Invalid publish mode' });
		if (!isHostProvider(hostProvider)) return fail(400, { message: 'Invalid host provider' });

		if (!theme.brandName) theme.brandName = name;

		try {
			await assertCanCreateStatusPage(team.id);
		} catch (err) {
			if (isLimitError(err)) {
				return fail(403, { message: err.message, upgrade: true });
			}
			throw err;
		}

		const id = crypto.randomUUID();
		try {
			await db.insert(statusPage).values({
				id,
				name,
				slug,
				description,
				publishMode,
				hostProvider,
				publishBaseDomain,
				publishPathPrefix,
				ownerId: locals.user.id,
				teamId: team.id,
				themeJson: serializePageTheme(theme)
			});
		} catch (err) {
			console.error('[skinnystatus] create project failed', err);
			return fail(400, { message: 'Could not create project (slug may already exist)' });
		}

		return { success: true };
	},
	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		const name = form.get('name')?.toString().trim() ?? '';
		const slug = (form.get('slug')?.toString().trim() ?? '').toLowerCase();
		const description = form.get('description')?.toString().trim() || null;
		const publishMode = form.get('publishMode')?.toString() ?? 'path';
		const hostProvider = form.get('hostProvider')?.toString() ?? 'vercel';
		const theme = themeFromForm(form);
		const checkDetailsEnabled = form.get('checkDetailsEnabled') === 'on';
		const checkDetailsIncludeErrors =
			checkDetailsEnabled && form.get('checkDetailsIncludeErrors') === 'on';

		let publishBaseDomain: string | null = null;
		let publishPathPrefix = 's';
		try {
			publishBaseDomain = normalizePublishBaseDomain(
				form.get('publishBaseDomain')?.toString() ?? ''
			);
			publishPathPrefix = normalizePublishPathPrefix(
				form.get('publishPathPrefix')?.toString() ?? 's'
			);
		} catch (err) {
			return fail(400, {
				message: err instanceof Error ? err.message : 'Invalid publishing settings'
			});
		}

		if (!id || !name) return fail(400, { message: 'ID and name are required' });
		{
			const slugError = slugValidationMessage(slug);
			if (slugError) return fail(400, { message: slugError });
		}
		if (!isPublishMode(publishMode)) return fail(400, { message: 'Invalid publish mode' });
		if (!isHostProvider(hostProvider)) return fail(400, { message: 'Invalid host provider' });

		const canMutate = await userCanMutatePage(locals.user.id, id);
		if (!canMutate) return fail(404, { message: 'Project not found' });

		const canLifecycle = await userCanManagePageLifecycle(locals.user.id, id);

		try {
			if (canLifecycle) {
				await db
					.update(statusPage)
					.set({
						name,
						slug,
						description,
						publishMode,
						hostProvider,
						publishBaseDomain,
						publishPathPrefix,
						themeJson: serializePageTheme(theme),
						checkDetailsEnabled,
						checkDetailsIncludeErrors,
						updatedAt: new Date()
					})
					.where(eq(statusPage.id, id));
			} else {
				await db
					.update(statusPage)
					.set({
						name,
						description,
						themeJson: serializePageTheme(theme),
						checkDetailsEnabled,
						checkDetailsIncludeErrors,
						updatedAt: new Date()
					})
					.where(eq(statusPage.id, id));
			}
		} catch (err) {
			console.error('[skinnystatus] update project failed', err);
			return fail(400, { message: 'Could not update project (slug may already exist)' });
		}

		return { success: true };
	},
	softDelete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		const confirmName = form.get('confirmName')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const canLifecycle = await userCanManagePageLifecycle(locals.user.id, id);
		if (!canLifecycle) return fail(404, { message: 'Project not found' });

		const page = await getAccessibleStatusPage(id, locals.user.id);
		if (!page) return fail(404, { message: 'Project not found' });
		if (confirmName !== page.name) {
			return fail(400, { message: 'Name does not match. Please type the project name exactly.' });
		}

		const now = new Date();
		await db
			.update(statusPage)
			.set({ deletedAt: now, updatedAt: now })
			.where(eq(statusPage.id, id));
		return { success: true };
	},
	undelete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const canLifecycle = await userCanManagePageLifecycle(locals.user.id, id);
		if (!canLifecycle) return fail(404, { message: 'Project not found' });

		const page = await getAccessibleStatusPage(id, locals.user.id);
		if (!page) return fail(404, { message: 'Project not found' });
		if (!page.deletedAt) return fail(400, { message: 'Project is not deleted' });

		await db
			.update(statusPage)
			.set({ deletedAt: null, updatedAt: new Date() })
			.where(eq(statusPage.id, id));
		return { success: true };
	},
	purge: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const canLifecycle = await userCanManagePageLifecycle(locals.user.id, id);
		if (!canLifecycle) return fail(404, { message: 'Project not found' });

		const page = await getAccessibleStatusPage(id, locals.user.id);
		if (!page) return fail(404, { message: 'Project not found' });
		if (!page.deletedAt)
			return fail(400, { message: 'Project must be deleted before it can be purged' });

		await db.delete(statusPage).where(eq(statusPage.id, id));
		return { success: true };
	},
	setPublished: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		const publishedStr = form.get('published')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const canMutate = await userCanMutatePage(locals.user.id, id);
		if (!canMutate) return fail(404, { message: 'Project not found' });

		const published = publishedStr === 'true';
		await db
			.update(statusPage)
			.set({ published, updatedAt: new Date() })
			.where(eq(statusPage.id, id));
		return { success: true };
	},
	deploy: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		const hostProvider = form.get('hostProvider')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });
		if (!isHostProvider(hostProvider)) return fail(400, { message: 'Invalid host provider' });

		const row = await getAccessibleStatusPage(id, locals.user.id);
		if (!row) return fail(404, { message: 'Project not found' });

		const project = toPageInfo(row);
		const providerChanged = hostProvider !== project.hostProvider;
		const deployTarget = {
			...project,
			hostProvider,
			deployProviderId: providerChanged ? null : project.deployProviderId
		};

		try {
			const result = await deployProject(deployTarget, locals.user.id);
			await db
				.update(statusPage)
				.set({
					hostProvider,
					deployUrl: result.url,
					deployProviderId: result.providerId,
					lastDeployedAt: new Date(),
					lastDeployError: null,
					updatedAt: new Date()
				})
				.where(eq(statusPage.id, id));
			return {
				success: true,
				deployedUrl: result.url,
				customDomain: result.customDomain
					? {
							hostname: result.customDomain.hostname,
							registered: result.customDomain.registered,
							verified: result.customDomain.verified,
							cnameTarget: result.customDomain.cnameTarget,
							warning: result.customDomain.warning
						}
					: undefined
			};
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Deploy failed';
			await db
				.update(statusPage)
				.set({
					lastDeployError: message,
					updatedAt: new Date()
				})
				.where(eq(statusPage.id, id));
			return fail(400, { message });
		}
	}
};
