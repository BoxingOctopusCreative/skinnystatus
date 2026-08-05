import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import {
	auth,
	isGithubOAuthEnabled,
	isGoogleOAuthEnabled,
	isSocialAuthProvider,
	startSocialSignIn
} from '$lib/server/auth';
import {
	isAccountDeleted,
	isWithinReactivationGrace
} from '$lib/server/account-lifecycle';
import { BRAND_NAME } from '$lib/brand';
import { db, user } from '$lib/server/db';
import { getTurnstileSiteKey, requireTurnstile } from '$lib/server/turnstile';

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectToParam = url.searchParams.get('redirectTo');
	const safeRedirect =
		redirectToParam && redirectToParam.startsWith('/') && !redirectToParam.startsWith('//')
			? redirectToParam
			: '/dashboard';
	if (locals.user) throw redirect(303, safeRedirect);
	const oauthError = url.searchParams.get('error');
	const reset = url.searchParams.get('reset') === '1';
	const reactivated = url.searchParams.get('reactivated') === '1';
	const deleted = url.searchParams.get('deleted') === '1';
	return {
		siteName: BRAND_NAME,
		githubOAuthEnabled: isGithubOAuthEnabled(),
		googleOAuthEnabled: isGoogleOAuthEnabled(),
		githubError: oauthError === 'github',
		googleError: oauthError === 'google',
		reset,
		reactivated,
		deleted,
		turnstileSiteKey: getTurnstileSiteKey()
	};
};

async function findUserForSignIn(identifier: string) {
	if (identifier.includes('@')) {
		const [row] = await db.select().from(user).where(eq(user.email, identifier)).limit(1);
		return row;
	}
	const [row] = await db.select().from(user).where(eq(user.username, identifier)).limit(1);
	return row;
}

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const turnstileFail = await requireTurnstile(formData, event.getClientAddress());
		if (turnstileFail) return turnstileFail;

		const identifier = formData.get('email')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const redirectTo = formData.get('redirectTo')?.toString() || '/dashboard';

		const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard';

		const existing = identifier ? await findUserForSignIn(identifier) : undefined;
		if (existing && isAccountDeleted(existing) && !isWithinReactivationGrace(existing)) {
			return fail(400, {
				message: 'This account has been permanently deleted and cannot be recovered.'
			});
		}

		try {
			if (identifier.includes('@')) {
				await auth.api.signInEmail({
					body: { email: identifier, password },
					headers: event.request.headers
				});
			} else {
				// username plugin endpoint
				await (
					auth.api as typeof auth.api & {
						signInUsername: (args: {
							body: { username: string; password: string };
							headers: Headers;
						}) => Promise<unknown>;
					}
				).signInUsername({
					body: { username: identifier, password },
					headers: event.request.headers
				});
			}
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Sign-in failed' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		if (existing && isAccountDeleted(existing) && isWithinReactivationGrace(existing)) {
			throw redirect(303, '/reactivate');
		}

		throw redirect(303, safeRedirect);
	},
	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const callbackURL = formData.get('callbackURL')?.toString() || '/dashboard';
		const providerRaw = formData.get('provider')?.toString() ?? 'github';
		if (!isSocialAuthProvider(providerRaw)) {
			return fail(400, { message: 'Unsupported sign-in provider' });
		}

		const label = providerRaw === 'google' ? 'Google' : 'GitHub';
		try {
			const url = await startSocialSignIn(event.request.headers, providerRaw, callbackURL);
			if (!url) return fail(400, { message: `${label} sign-in is not configured` });
			throw redirect(302, url);
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) {
				return fail(400, { message: error.message || `${label} sign-in failed` });
			}
			return fail(500, { message: `${label} sign-in failed` });
		}
	}
};
