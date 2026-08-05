import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Permanent redirect: /admin/* → /dashboard/* */
const toDashboard: RequestHandler = async ({ params, url }) => {
	throw redirect(308, `/dashboard/${params.path}${url.search}`);
};

export const GET = toDashboard;
export const POST = toDashboard;
export const PUT = toDashboard;
export const PATCH = toDashboard;
export const DELETE = toDashboard;
