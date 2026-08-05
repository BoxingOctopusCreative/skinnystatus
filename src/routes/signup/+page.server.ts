import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import {
	auth,
	isGithubOAuthEnabled,
	isGoogleOAuthEnabled,
	isSocialAuthProvider,
	startSocialSignIn
} from '$lib/server/auth';
import { BRAND_NAME } from '$lib/brand';
import { getTurnstileSiteKey, requireTurnstile } from '$lib/server/turnstile';

function safeRedirectPath(value: string | undefined | null, fallback = '/dashboard'): string {
	if (!value) return fallback;
	return value.startsWith('/') ? value : fallback;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const redirectTo = safeRedirectPath(url.searchParams.get('redirectTo'));
	if (locals.user) throw redirect(303, redirectTo);
	const oauthError = url.searchParams.get('error');
	return {
		siteName: BRAND_NAME,
		githubOAuthEnabled: isGithubOAuthEnabled(),
		googleOAuthEnabled: isGoogleOAuthEnabled(),
		githubError: oauthError === 'github',
		googleError: oauthError === 'google',
		redirectTo,
		turnstileSiteKey: getTurnstileSiteKey()
	};
};

export const actions: Actions = {
	signUp: async (event) => {
		const formData = await event.request.formData();
		const turnstileFail = await requireTurnstile(formData, event.getClientAddress());
		if (turnstileFail) return turnstileFail;

		const name = formData.get('name')?.toString().trim() ?? '';
		const email = formData.get('email')?.toString().trim() ?? '';
		const username = formData.get('username')?.toString().trim() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const redirectTo = safeRedirectPath(formData.get('redirectTo')?.toString());

		if (!name) return fail(400, { message: 'Name is required' });
		if (!email) return fail(400, { message: 'Email is required' });
		if (!username) return fail(400, { message: 'Username is required' });
		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		try {
			await auth.api.signUpEmail({
				body: {
					email,
					password,
					name,
					username
				} as { email: string; password: string; name: string; username: string },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { message: error.message || 'Could not create account' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		throw redirect(303, redirectTo);
	},
	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const callbackURL = safeRedirectPath(formData.get('callbackURL')?.toString());
		const providerRaw = formData.get('provider')?.toString() ?? 'github';
		if (!isSocialAuthProvider(providerRaw)) {
			return fail(400, { message: 'Unsupported sign-up provider' });
		}

		const label = providerRaw === 'google' ? 'Google' : 'GitHub';
		try {
			const url = await startSocialSignIn(event.request.headers, providerRaw, callbackURL);
			if (!url) return fail(400, { message: `${label} sign-up is not configured` });
			throw redirect(302, url);
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) {
				return fail(400, { message: error.message || `${label} sign-up failed` });
			}
			return fail(500, { message: `${label} sign-up failed` });
		}
	}
};
