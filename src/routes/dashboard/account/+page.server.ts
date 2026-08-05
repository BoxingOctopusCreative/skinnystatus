import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { auth, isGithubOAuthEnabled, isGoogleOAuthEnabled, startSocialLink } from '$lib/server/auth';
import { softDeleteAccount } from '$lib/server/account-lifecycle';
import {
	resolveImageUrl,
	isR2Configured,
	putObject,
	avatarObjectKey,
	R2_IMAGE_PREFIX
} from '$lib/server/r2';
import { db, account as accountTable, user as userTable, passkey as passkeyTable } from '$lib/server/db';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type ActionResult = { success: boolean; message?: string | null };
type TwoFactorEnableResult = ActionResult & {
	totpURI: string | null;
	backupCodes: string[];
};

function actionOk(): ActionResult {
	return { success: true, message: null };
}

function actionFail(message: string): ActionResult {
	return { success: false, message };
}

function twoFactorFail(message: string): TwoFactorEnableResult {
	return { success: false, message, totpURI: null, backupCodes: [] };
}

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) throw redirect(303, '/dashboard/login');

	const userId = locals.user.id;

	const [dbUser] = await db
		.select({
			name: userTable.name,
			email: userTable.email,
			username: userTable.username,
			displayUsername: userTable.displayUsername,
			image: userTable.image,
			twoFactorEnabled: userTable.twoFactorEnabled
		})
		.from(userTable)
		.where(eq(userTable.id, userId))
		.limit(1);

	const accounts = await db
		.select({ providerId: accountTable.providerId, password: accountTable.password })
		.from(accountTable)
		.where(eq(accountTable.userId, userId));

	const hasPassword = accounts.some(
		(row: { providerId: string; password: string | null }) =>
			(row.providerId === 'credential' || row.providerId === 'email') && Boolean(row.password)
	);
	const hasGithub = accounts.some(
		(row: { providerId: string }) => row.providerId === 'github'
	);
	const hasGoogle = accounts.some(
		(row: { providerId: string }) => row.providerId === 'google'
	);
	const githubOAuthEnabled = isGithubOAuthEnabled();
	const googleOAuthEnabled = isGoogleOAuthEnabled();
	if (!hasGithub && !githubOAuthEnabled && !hasGoogle && !googleOAuthEnabled) {
		console.error(
			'[skinnystatus] No social OAuth providers are configured; account linking is unavailable.'
		);
	}

	const passkeys = await db
		.select({
			id: passkeyTable.id,
			name: passkeyTable.name,
			createdAt: passkeyTable.createdAt
		})
		.from(passkeyTable)
		.where(eq(passkeyTable.userId, userId));

	const imageUrl = await resolveImageUrl(dbUser?.image ?? null);
	const r2Configured = isR2Configured();
	if (!r2Configured) {
		console.error(
			'[skinnystatus] Cloudflare R2 is not configured; profile picture upload will fail. Set Infisical /r2 secrets or R2_* env vars.'
		);
	}

	const oauthError = url.searchParams.get('error');
	if (oauthError === 'github' || oauthError === 'google') {
		console.error('[skinnystatus] Social account link failed', {
			provider: oauthError,
			error: oauthError,
			error_description: url.searchParams.get('error_description')
		});
	}

	return {
		name: dbUser?.name ?? locals.user.name,
		email: dbUser?.email ?? locals.user.email,
		username: dbUser?.username ?? null,
		displayUsername: dbUser?.displayUsername ?? null,
		imageUrl,
		hasPassword,
		hasGithub,
		hasGoogle,
		githubOAuthEnabled,
		googleOAuthEnabled,
		githubLinkError: oauthError === 'github',
		googleLinkError: oauthError === 'google',
		twoFactorEnabled: dbUser?.twoFactorEnabled ?? false,
		passkeys
	};
};

export const actions: Actions = {
	updateProfile: async (event) => {
		if (!event.locals.user) {
			return fail(401, { updateProfile: actionFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const usernameRaw = formData.get('username')?.toString().trim() ?? '';
		const username = usernameRaw.toLowerCase().replace(/[^a-z0-9_-]/g, '') || null;

		if (!name) return fail(400, { updateProfile: actionFail('Name is required') });

		try {
			await auth.api.updateUser({
				body: { name },
				headers: event.request.headers
			});
			await db
				.update(userTable)
				.set({
					username,
					displayUsername: usernameRaw || null
				})
				.where(eq(userTable.id, event.locals.user.id));
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { updateProfile: actionFail(err.message || 'Update failed') });
			}
			return fail(500, { updateProfile: actionFail('Unexpected error') });
		}

		return { updateProfile: actionOk() };
	},

	uploadAvatar: async (event) => {
		if (!event.locals.user) {
			return fail(401, { uploadAvatar: actionFail('Not authenticated') });
		}
		if (!isR2Configured()) {
			console.error(
				'[skinnystatus] Avatar upload failed: Cloudflare R2 is not configured. Set Infisical /r2 secrets or R2_* env vars.'
			);
			return fail(503, {
				uploadAvatar: actionFail('Profile picture upload is temporarily unavailable.')
			});
		}

		const formData = await event.request.formData();
		const file = formData.get('avatar');

		if (!(file instanceof File) || file.size === 0) {
			return fail(400, { uploadAvatar: actionFail('No file selected') });
		}
		if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
			return fail(400, {
				uploadAvatar: actionFail('File must be an image (JPEG, PNG, GIF, or WebP)')
			});
		}
		if (file.size > AVATAR_MAX_BYTES) {
			return fail(400, { uploadAvatar: actionFail('File must be 2 MB or smaller') });
		}

		const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin';
		const key = avatarObjectKey(event.locals.user.id, ext);
		const body = new Uint8Array(await file.arrayBuffer());

		try {
			await putObject({ key, body, contentType: file.type });
		} catch (err) {
			console.error('[skinnystatus] avatar upload failed', err);
			return fail(500, { uploadAvatar: actionFail('Upload failed. Try again.') });
		}

		const imageRef = `${R2_IMAGE_PREFIX}${key}`;
		await db
			.update(userTable)
			.set({ image: imageRef })
			.where(eq(userTable.id, event.locals.user.id));

		return { uploadAvatar: actionOk() };
	},

	changePassword: async (event) => {
		if (!event.locals.user) {
			return fail(401, { changePassword: actionFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const currentPassword = formData.get('currentPassword')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirm = formData.get('confirm')?.toString() ?? '';

		if (!currentPassword) {
			return fail(400, { changePassword: actionFail('Current password is required') });
		}
		if (newPassword.length < 8) {
			return fail(400, {
				changePassword: actionFail('New password must be at least 8 characters')
			});
		}
		if (newPassword !== confirm) {
			return fail(400, { changePassword: actionFail('Passwords do not match') });
		}

		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					changePassword: actionFail(err.message || 'Password change failed')
				});
			}
			return fail(500, { changePassword: actionFail('Unexpected error') });
		}

		return { changePassword: actionOk() };
	},

	requestPasswordSetup: async (event) => {
		if (!event.locals.user) {
			return fail(401, { requestPasswordSetup: actionFail('Not authenticated') });
		}

		try {
			await auth.api.requestPasswordReset({
				body: { email: event.locals.user.email },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					requestPasswordSetup: actionFail(err.message || 'Request failed')
				});
			}
			return fail(500, { requestPasswordSetup: actionFail('Unexpected error') });
		}

		return { requestPasswordSetup: actionOk() };
	},

	linkGithub: async (event) => {
		if (!event.locals.user) {
			return fail(401, { linkGithub: actionFail('Not authenticated') });
		}

		try {
			const url = await startSocialLink(event.request.headers, 'github', '/dashboard/account');
			if (!url) {
				console.error(
					'[skinnystatus] GitHub OAuth is not configured; cannot link GitHub account.'
				);
				return fail(503, {
					linkGithub: actionFail('Could not connect GitHub. Try again.')
				});
			}
			throw redirect(302, url);
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[skinnystatus] linkGithub failed', err);
			return fail(500, {
				linkGithub: actionFail('Could not connect GitHub. Try again.')
			});
		}
	},

	linkGoogle: async (event) => {
		if (!event.locals.user) {
			return fail(401, { linkGoogle: actionFail('Not authenticated') });
		}

		try {
			const url = await startSocialLink(event.request.headers, 'google', '/dashboard/account');
			if (!url) {
				console.error(
					'[skinnystatus] Google OAuth is not configured; cannot link Google account.'
				);
				return fail(503, {
					linkGoogle: actionFail('Could not connect Google. Try again.')
				});
			}
			throw redirect(302, url);
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[skinnystatus] linkGoogle failed', err);
			return fail(500, {
				linkGoogle: actionFail('Could not connect Google. Try again.')
			});
		}
	},

	enableTwoFactor: async (event) => {
		if (!event.locals.user) {
			return fail(401, { enableTwoFactor: twoFactorFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';

		if (!password) {
			return fail(400, { enableTwoFactor: twoFactorFail('Password is required') });
		}

		try {
			const result = await auth.api.enableTwoFactor({
				body: { password },
				headers: event.request.headers
			});
			return {
				enableTwoFactor: {
					success: true,
					message: null,
					totpURI: result?.totpURI ?? null,
					backupCodes: Array.isArray(result?.backupCodes) ? result.backupCodes : []
				} satisfies TwoFactorEnableResult
			};
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					enableTwoFactor: twoFactorFail(err.message || 'Failed to enable 2FA')
				});
			}
			return fail(500, { enableTwoFactor: twoFactorFail('Unexpected error') });
		}
	},

	disableTwoFactor: async (event) => {
		if (!event.locals.user) {
			return fail(401, { disableTwoFactor: actionFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';

		if (!password) {
			return fail(400, { disableTwoFactor: actionFail('Password is required') });
		}

		try {
			await auth.api.disableTwoFactor({
				body: { password },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					disableTwoFactor: actionFail(err.message || 'Failed to disable 2FA')
				});
			}
			return fail(500, { disableTwoFactor: actionFail('Unexpected error') });
		}

		return { disableTwoFactor: actionOk() };
	},

	deletePasskey: async (event) => {
		if (!event.locals.user) {
			return fail(401, { deletePasskey: actionFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const id = formData.get('id')?.toString() ?? '';

		if (!id) return fail(400, { deletePasskey: actionFail('Passkey ID is required') });

		try {
			await auth.api.deletePasskey({
				body: { id },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, {
					deletePasskey: actionFail(err.message || 'Failed to delete passkey')
				});
			}
			return fail(500, { deletePasskey: actionFail('Unexpected error') });
		}

		return { deletePasskey: actionOk() };
	},

	deleteAccount: async (event) => {
		if (!event.locals.user) {
			return fail(401, { deleteAccount: actionFail('Not authenticated') });
		}

		const formData = await event.request.formData();
		const confirmEmail = formData.get('confirmEmail')?.toString() ?? '';

		if (confirmEmail !== event.locals.user.email) {
			return fail(400, {
				deleteAccount: actionFail('Email does not match. Type your email to confirm.')
			});
		}

		try {
			await softDeleteAccount(event.locals.user.id);
		} catch (err) {
			console.error('[skinnystatus] softDeleteAccount failed', err);
			return fail(500, { deleteAccount: actionFail('Unexpected error') });
		}

		throw redirect(303, '/dashboard/login?deleted=1');
	}
};
