import { fail, isHttpError, isRedirect, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { HOST_PROVIDERS, isHostProvider, type HostProvider } from '$lib/publishing';
import { resolveCurrentTeam } from '$lib/server/dashboard-page';
import { db, team as teamTable } from '$lib/server/db';
import {
	deleteHostCredentials,
	getHostCredentials,
	providerReadyMap,
	upsertHostCredentials,
	type HostCredsByProvider,
	type HostCredentials
} from '$lib/server/host-credentials';
import { testHostConnectivity } from '$lib/server/host-connectivity';
import {
	createTeamInvite,
	deleteTeam,
	getTeamById,
	leaveTeam,
	listPendingInvites,
	listTeamMembers,
	removeMember,
	revokeInvite,
	roleAtLeast,
	setMemberRole,
	updateTeamPublishing,
	userCanManageTeam
} from '$lib/server/teams';
import {
	deleteObject,
	isR2Configured,
	parseImageRef,
	putObject,
	resolveImageUrl,
	R2_IMAGE_PREFIX,
	teamBannerObjectKey
} from '$lib/server/r2';

const BANNER_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const { team, teams } = await resolveCurrentTeam(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});

	const canManage = roleAtLeast(team.role, 'admin');
	const members = await listTeamMembers(team.id);
	const invites = canManage ? await listPendingInvites(team.id) : [];
	const bannerUrl = await resolveImageUrl(team.bannerImage);

	const providerReady = await providerReadyMap(team.id);
	const credentials = {} as Partial<Record<HostProvider, HostCredentials>>;

	for (const provider of HOST_PROVIDERS) {
		if (!providerReady[provider]) continue;
		const creds = await getHostCredentials(team.id, provider);
		if (creds) credentials[provider] = creds;
	}

	if (!isR2Configured()) {
		console.error(
			'[skinnystatus] Cloudflare R2 is not configured; team banner upload will fail. Set Infisical /r2 secrets or R2_* env vars.'
		);
	}

	return {
		team,
		teams,
		bannerUrl,
		role: team.role,
		canManage,
		isOwner: team.role === 'owner',
		members,
		invites,
		inviteLink: url.searchParams.get('inviteLink'),
		inviteEmailSent: url.searchParams.get('email') === '1',
		publishBaseDomain: team.publishBaseDomain ?? '',
		publishPathPrefix: team.publishPathPrefix || 's',
		providers: HOST_PROVIDERS,
		providerReady,
		credentials
	};
};

export const actions: Actions = {
	savePublishing: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!roleAtLeast(team.role, 'admin')) {
			return fail(403, { message: 'Only team owners and admins can edit publishing settings' });
		}

		const form = await request.formData();
		const publishBaseDomain = form.get('publishBaseDomain')?.toString() ?? '';
		const publishPathPrefix = form.get('publishPathPrefix')?.toString() ?? 's';

		try {
			await updateTeamPublishing(team.id, { publishBaseDomain, publishPathPrefix });
			return { success: true, publishing: true };
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Could not save publishing settings';
			return fail(400, { message });
		}
	},

	save: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!roleAtLeast(team.role, 'admin')) {
			return fail(403, { message: 'Only team owners and admins can manage credentials' });
		}

		const form = await request.formData();
		const provider = form.get('provider')?.toString() ?? '';
		if (!isHostProvider(provider)) return fail(400, { message: 'Invalid provider' });

		try {
			const creds = parseProviderForm(provider, form);
			await upsertHostCredentials(team.id, provider, creds);
			return { success: true, provider };
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Could not save credentials';
			return fail(400, { message });
		}
	},
	test: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!roleAtLeast(team.role, 'admin')) {
			return fail(403, { message: 'Only team owners and admins can test credentials' });
		}

		const form = await request.formData();
		const provider = form.get('provider')?.toString() ?? '';
		if (!isHostProvider(provider)) return fail(400, { message: 'Invalid provider' });
		const submitted = getSubmittedValues(form);

		try {
			const creds = parseProviderForm(provider, form);
			const testMessage = await testHostConnectivity(provider, creds);
			return { success: true, tested: provider, testMessage, submitted };
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Could not test credentials';
			return fail(400, { message, tested: provider, submitted });
		}
	},
	clear: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!roleAtLeast(team.role, 'admin')) {
			return fail(403, { message: 'Only team owners and admins can clear credentials' });
		}

		const form = await request.formData();
		const provider = form.get('provider')?.toString() ?? '';
		if (!isHostProvider(provider)) return fail(400, { message: 'Invalid provider' });
		await deleteHostCredentials(team.id, provider);
		return { success: true, cleared: provider };
	},

	uploadBanner: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!(await userCanManageTeam(team.id, locals.user.id))) {
			return fail(403, { message: 'Insufficient team permissions' });
		}

		if (!isR2Configured()) {
			console.error(
				'[skinnystatus] Team banner upload failed: Cloudflare R2 is not configured.'
			);
			return fail(503, { message: 'Banner upload is temporarily unavailable.' });
		}

		const formData = await request.formData();
		const file = formData.get('banner');
		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { message: 'No file selected' });
		}
		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			return fail(400, { message: 'File must be an image (JPEG, PNG, GIF, or WebP)' });
		}
		if (file.size > BANNER_MAX_BYTES) {
			return fail(400, { message: 'File must be 5 MB or smaller' });
		}

		const existing = await getTeamById(team.id);
		if (!existing) return fail(404, { message: 'Team not found' });

		const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
		const key = teamBannerObjectKey(team.id, ext);
		const body = new Uint8Array(await file.arrayBuffer());

		try {
			await putObject({ key, body, contentType: file.type });
		} catch (err) {
			console.error('[skinnystatus] team banner upload failed', err);
			return fail(500, { message: 'Upload failed. Try again.' });
		}

		const oldRef = parseImageRef(existing.bannerImage);
		if (oldRef.kind === 'r2' && oldRef.value && oldRef.value !== key) {
			try {
				await deleteObject(oldRef.value);
			} catch (err) {
				console.error('[skinnystatus] old team banner delete failed', err);
			}
		}

		await db
			.update(teamTable)
			.set({ bannerImage: `${R2_IMAGE_PREFIX}${key}`, updatedAt: new Date() })
			.where(eq(teamTable.id, team.id));

		return { success: true };
	},

	removeBanner: async ({ locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		if (!(await userCanManageTeam(team.id, locals.user.id))) {
			return fail(403, { message: 'Insufficient team permissions' });
		}

		const existing = await getTeamById(team.id);
		if (!existing) return fail(404, { message: 'Team not found' });

		const ref = parseImageRef(existing.bannerImage);
		if (ref.kind === 'r2' && ref.value) {
			try {
				await deleteObject(ref.value);
			} catch (err) {
				console.error('[skinnystatus] team banner delete failed', err);
			}
		}

		await db
			.update(teamTable)
			.set({ bannerImage: null, updatedAt: new Date() })
			.where(eq(teamTable.id, team.id));

		return { success: true };
	},

	invite: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		const form = await request.formData();
		const email = form.get('email')?.toString().trim() || null;
		const roleRaw = form.get('role')?.toString() ?? 'member';
		const role = roleRaw === 'admin' ? 'admin' : 'member';

		try {
			const { link, invite } = await createTeamInvite({
				teamId: team.id,
				createdByUserId: locals.user.id,
				email,
				role
			});
			const qs = new URLSearchParams({ inviteLink: link });
			if (invite.email) qs.set('email', '1');
			throw redirect(303, `/dashboard/settings?team=${team.id}&${qs.toString()}`);
		} catch (err) {
			if (isRedirect(err)) throw err;
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] createTeamInvite failed', err);
			return fail(500, { message: 'Could not create invite' });
		}
	},
	revokeInvite: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		const form = await request.formData();
		const inviteId = form.get('inviteId')?.toString() ?? '';
		if (!inviteId) return fail(400, { message: 'Invite ID required' });
		try {
			await revokeInvite(inviteId, locals.user.id);
		} catch (err) {
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] revokeInvite failed', err);
			return fail(500, { message: 'Could not revoke invite' });
		}
		return { success: true };
	},
	setRole: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		const form = await request.formData();
		const userId = form.get('userId')?.toString() ?? '';
		const roleRaw = form.get('role')?.toString() ?? 'member';
		const role = roleRaw === 'admin' ? 'admin' : 'member';
		if (!userId) return fail(400, { message: 'User ID required' });
		try {
			await setMemberRole(team.id, locals.user.id, userId, role);
		} catch (err) {
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] setMemberRole failed', err);
			return fail(500, { message: 'Could not update role' });
		}
		return { success: true };
	},
	removeMember: async ({ request, locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		const form = await request.formData();
		const userId = form.get('userId')?.toString() ?? '';
		if (!userId) return fail(400, { message: 'User ID required' });
		try {
			await removeMember(team.id, locals.user.id, userId);
		} catch (err) {
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] removeMember failed', err);
			return fail(400, {
				message: err instanceof Error ? err.message : 'Could not remove member'
			});
		}
		return { success: true };
	},
	leave: async ({ locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		try {
			await leaveTeam(team.id, locals.user.id);
		} catch (err) {
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] leaveTeam failed', err);
			return fail(400, {
				message: err instanceof Error ? err.message : 'Could not leave team'
			});
		}
		throw redirect(303, '/dashboard');
	},
	deleteTeam: async ({ locals, url, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const { team } = await resolveCurrentTeam(url, locals.user.id, cookies, {
			email: locals.user.email,
			name: locals.user.name
		});
		try {
			await deleteTeam(team.id, locals.user.id);
		} catch (err) {
			if (isHttpError(err)) throw err;
			console.error('[skinnystatus] deleteTeam failed', err);
			return fail(500, { message: 'Could not delete team' });
		}
		throw redirect(303, '/dashboard');
	}
};

function parseProviderForm<P extends HostProvider>(
	provider: P,
	form: FormData
): HostCredsByProvider[P] {
	switch (provider) {
		case 'vercel': {
			const token = form.get('token')?.toString().trim() ?? '';
			const teamId = form.get('teamId')?.toString().trim() || null;
			if (!token) throw new Error('Vercel token is required');
			return { token, teamId } as HostCredsByProvider[P];
		}
		case 'cloudflare_pages': {
			const apiToken = form.get('apiToken')?.toString().trim() ?? '';
			const accountId = form.get('accountId')?.toString().trim() ?? '';
			if (!apiToken || !accountId) {
				throw new Error('Cloudflare API token and account ID are required');
			}
			return { apiToken, accountId } as HostCredsByProvider[P];
		}
		case 'netlify': {
			const token = form.get('token')?.toString().trim() ?? '';
			if (!token) throw new Error('Netlify token is required');
			return { token } as HostCredsByProvider[P];
		}
		case 'github_pages': {
			const token = form.get('token')?.toString().trim() ?? '';
			const owner = form.get('owner')?.toString().trim() ?? '';
			if (!token || !owner) throw new Error('GitHub token and owner are required');
			return { token, owner } as HostCredsByProvider[P];
		}
		case 'static_app': {
			const apiKey = form.get('apiKey')?.toString().trim() ?? '';
			if (!apiKey) throw new Error('static.app API key is required');
			return { apiKey } as HostCredsByProvider[P];
		}
		case 'amazon_s3': {
			const accessKeyId = form.get('accessKeyId')?.toString().trim() ?? '';
			const secretAccessKey = form.get('secretAccessKey')?.toString().trim() ?? '';
			const bucket = form.get('bucket')?.toString().trim() ?? '';
			const region = form.get('region')?.toString().trim() ?? '';
			const publicBaseUrl = form.get('publicBaseUrl')?.toString().trim() ?? '';
			if (!accessKeyId || !secretAccessKey || !bucket || !region || !publicBaseUrl) {
				throw new Error(
					'S3 access key, secret, bucket, region, and public base URL are required'
				);
			}
			return {
				accessKeyId,
				secretAccessKey,
				bucket,
				region,
				publicBaseUrl: publicBaseUrl.replace(/\/$/, '')
			} as HostCredsByProvider[P];
		}
		case 'firebase_hosting': {
			const siteId = form.get('siteId')?.toString().trim() ?? '';
			const serviceAccountJson = form.get('serviceAccountJson')?.toString().trim() ?? '';
			if (!siteId || !serviceAccountJson) {
				throw new Error('Firebase site ID and service account JSON are required');
			}
			try {
				JSON.parse(serviceAccountJson);
			} catch {
				throw new Error('Firebase service account JSON is invalid');
			}
			return {
				siteId,
				serviceAccountJson
			} as HostCredsByProvider[P];
		}
		case 'azure_static_web_apps': {
			const deploymentToken = form.get('deploymentToken')?.toString().trim() ?? '';
			const publicBaseUrl = form.get('publicBaseUrl')?.toString().trim() ?? '';
			if (!deploymentToken || !publicBaseUrl) {
				throw new Error(
					'Azure Static Web Apps deployment token and public base URL are required'
				);
			}
			return {
				deploymentToken,
				publicBaseUrl: publicBaseUrl.replace(/\/$/, '')
			} as HostCredsByProvider[P];
		}
	}
}

function getSubmittedValues(form: FormData): Record<string, string> {
	return Object.fromEntries(
		Array.from(form.entries(), ([key, value]) => [key, value.toString()])
	);
}
