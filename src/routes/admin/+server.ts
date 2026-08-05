import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Permanent redirect: /admin → /dashboard */
const toDashboard: RequestHandler = async ({ url }) => {
	throw redirect(308, `/dashboard${url.search}`);
};

export const GET = toDashboard;
export const POST = toDashboard;
