import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	reactivateAccountByToken,
	reactivateAccountByUserId,
	isWithinReactivationGrace
} from '$lib/server/account-lifecycle';
import { BRAND_NAME } from '$lib/brand';
import { db, user as userTable } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ url, locals }) => {
	const token = url.searchParams.get('token') ?? '';

	if (token) {
		const ok = await reactivateAccountByToken(token);
		if (ok) {
			throw redirect(303, '/dashboard/login?reactivated=1');
		}
		return { siteName: BRAND_NAME, mode: 'invalid' as const };
	}

	if (locals.user) {
		const [dbUser] = await db
			.select({ deletedAt: userTable.deletedAt })
			.from(userTable)
			.where(eq(userTable.id, locals.user.id))
			.limit(1);

		if (dbUser && isWithinReactivationGrace(dbUser)) {
			return { siteName: BRAND_NAME, mode: 'loggedIn' as const };
		}
	}

	return { siteName: BRAND_NAME, mode: 'noToken' as const };
};

export const actions: Actions = {
	reactivate: async (event) => {
		if (!event.locals.user) {
			return fail(401, { message: 'You must be signed in to reactivate' });
		}

		const ok = await reactivateAccountByUserId(event.locals.user.id);
		if (!ok) {
			return fail(400, { message: 'Reactivation period has expired or account was not deleted' });
		}

		throw redirect(303, '/dashboard');
	}
};
