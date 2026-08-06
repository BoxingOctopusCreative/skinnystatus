import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import {
	isAccountDeleted,
	isWithinReactivationGrace
} from '$lib/server/account-lifecycle';
import { seedOnStartup } from '$lib/server/bootstrap';
import { startChecker } from '$lib/server/checker';
import { initConfig } from '$lib/server/config';
import { ensureDatabaseMigrated } from '$lib/server/db/migrate';
import { getStatusPageInfo } from '$lib/server/db/queries';
import { db, user as userTable } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { startPurgeJob } from '$lib/server/purge';
import {
	apexHost,
	parsePathSlug,
	stripPort
} from '$lib/server/publishing';
import { PLATFORM_PATH_PREFIX } from '$lib/publishing';

let initialized = false;

async function ensureRuntime(): Promise<void> {
	await initConfig();
	if (building || initialized) return;
	initialized = true;
	await ensureDatabaseMigrated();
	await seedOnStartup();
	startChecker();
	startPurgeJob();
}

const handleInit: Handle = async ({ event, resolve }) => {
	await ensureRuntime();
	event.locals.statusPage = null;
	return resolve(event);
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		const [dbUser] = await db
			.select({
				deletedAt: userTable.deletedAt
			})
			.from(userTable)
			.where(eq(userTable.id, session.user.id))
			.limit(1);

		if (dbUser && isAccountDeleted(dbUser)) {
			if (isWithinReactivationGrace(dbUser)) {
				const path = event.url.pathname;
				const allow =
					path.startsWith('/reactivate') ||
					path.startsWith('/api/auth') ||
					path === '/dashboard/logout' ||
					path.startsWith('/dashboard/logout');
				if (!allow) {
					throw redirect(303, '/reactivate');
				}
			} else {
				event.locals.session = undefined;
				event.locals.user = undefined;
				return svelteKitHandler({ event, resolve, auth, building });
			}
		}

		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handleResolvePage: Handle = async ({ event, resolve }) => {
	const host = stripPort(event.request.headers.get('host') ?? event.url.host);
	const apex = apexHost();

	// Admin preview only: platform-fixed `/s/{slug}` on the admin origin.
	// Published pages live on each team's static host; subdomain CNAMEs do not hit this app.
	const pathMatch = parsePathSlug(event.url.pathname, PLATFORM_PATH_PREFIX);
	if (
		pathMatch &&
		(host === apex || host === 'localhost' || host === '127.0.0.1')
	) {
		const page = await getStatusPageInfo(pathMatch.slug, 'path');
		event.locals.statusPage = page;
		return resolve(event);
	}

	event.locals.statusPage = null;
	return resolve(event);
};

const handleDashboardGuard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const isDashboard = path === '/dashboard' || path.startsWith('/dashboard/');
	const isLogin = path === '/dashboard/login' || path.startsWith('/dashboard/login/');

	if (isDashboard && !isLogin && !event.locals.user) {
		throw redirect(303, `/dashboard/login?redirectTo=${encodeURIComponent(path)}`);
	}

	if (isLogin && event.locals.user) {
		const redirectTo = event.url.searchParams.get('redirectTo');
		const safe =
			redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')
				? redirectTo
				: '/dashboard';
		throw redirect(303, safe);
	}

	return resolve(event);
};

export const handleError = Sentry.handleErrorWithSentry();

export const handle: Handle = sequence(
	Sentry.sentryHandle(),
	handleInit,
	handleBetterAuth,
	handleResolvePage,
	handleDashboardGuard
);
