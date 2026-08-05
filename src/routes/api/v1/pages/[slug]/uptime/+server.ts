import type { RequestHandler } from './$types';
import { jsonWithCors, optionsCors } from '$lib/server/api-cors';
import { getStatusPageBySlug, dailyUptimeBuckets, listServices } from '$lib/server/db/queries';

export const OPTIONS: RequestHandler = async () => optionsCors();

export const GET: RequestHandler = async ({ params, url }) => {
	const row = await getStatusPageBySlug(params.slug);
	if (!row) return jsonWithCors({ error: 'Not found' }, { status: 404 });

	const daysRaw = Number(url.searchParams.get('days') ?? '90');
	const days = Number.isFinite(daysRaw) ? Math.min(Math.max(Math.floor(daysRaw), 1), 90) : 90;

	const [services, buckets] = await Promise.all([
		listServices(row.id),
		dailyUptimeBuckets(row.id, days)
	]);

	return jsonWithCors({
		slug: row.slug,
		days,
		services: services.map((c) => ({
			id: c.id,
			name: c.name,
			buckets: buckets[c.id] ?? []
		}))
	});
};
