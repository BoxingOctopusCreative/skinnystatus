import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isHostProvider, type HostProvider } from '$lib/publishing';

const PROVIDER_TITLES: Record<HostProvider, string> = {
	vercel: 'Vercel',
	cloudflare_pages: 'Cloudflare Pages',
	netlify: 'Netlify',
	github_pages: 'GitHub Pages',
	static_app: 'static.app',
	amazon_s3: 'Amazon S3',
	firebase_hosting: 'Firebase Hosting',
	azure_static_web_apps: 'Azure Static Web Apps'
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');
	const provider = params.provider;
	if (!isHostProvider(provider)) error(404, 'Unknown provider');
	return {
		provider,
		title: PROVIDER_TITLES[provider]
	};
};
