import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	if (!dev) error(404, 'Not found');
	throw new Error('Sentry Example API Route Error');
};
