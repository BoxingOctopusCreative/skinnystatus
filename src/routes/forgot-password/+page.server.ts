import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { BRAND_NAME } from '$lib/brand';
import { getConfig } from '$lib/server/config';

export const load: PageServerLoad = async () => {
	return { siteName: BRAND_NAME };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString().trim() ?? '';

		if (!email) return fail(400, { sent: false, message: 'Email is required' });

		const baseUrl = getConfig().site.baseUrl.replace(/\/$/, '');

		try {
			await auth.api.requestPasswordReset({
				body: { email, redirectTo: `${baseUrl}/reset-password` },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				// Don't leak whether the email exists - still show success
			} else {
				console.error('[skinnystatus] requestPasswordReset error', err);
			}
		}

		// Always return success to avoid email enumeration
		return { sent: true };
	}
};
