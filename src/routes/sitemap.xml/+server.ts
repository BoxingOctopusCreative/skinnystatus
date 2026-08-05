import { getConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

const PUBLIC_PATHS = ['/', '/signup', '/dashboard/login', '/terms', '/privacy', '/sitemap'] as const;

export const GET: RequestHandler = async () => {
	const base = getConfig().site.baseUrl.replace(/\/$/, '');
	const lastmod = new Date().toISOString().slice(0, 10);

	const urls = PUBLIC_PATHS.map(
		(path) => `	<url>
		<loc>${base}${path === '/' ? '/' : path}</loc>
		<lastmod>${lastmod}</lastmod>
	</url>`
	).join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
