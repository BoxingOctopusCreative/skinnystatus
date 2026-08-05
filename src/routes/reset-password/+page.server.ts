import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { BRAND_NAME } from '$lib/brand';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token') ?? '';
	return { siteName: BRAND_NAME, token };
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const token = formData.get('token')?.toString() ?? '';
		const newPassword = formData.get('newPassword')?.toString() ?? '';
		const confirm = formData.get('confirm')?.toString() ?? '';

		if (!token) return fail(400, { message: 'Missing reset token. Use the link from your email.' });
		if (newPassword.length < 8) return fail(400, { message: 'Password must be at least 8 characters' });
		if (newPassword !== confirm) return fail(400, { message: 'Passwords do not match' });

		try {
			await auth.api.resetPassword({
				body: { token, newPassword },
				headers: event.request.headers
			});
		} catch (err) {
			if (err instanceof APIError) {
				return fail(400, { message: err.message || 'Reset failed. The link may have expired.' });
			}
			return fail(500, { message: 'Unexpected error' });
		}

		throw redirect(303, '/dashboard/login?reset=1');
	}
};
