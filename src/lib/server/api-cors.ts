import type { RequestEvent } from '@sveltejs/kit';

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400'
};

export function corsHeaders(): Record<string, string> {
	return { ...CORS_HEADERS };
}

export function jsonWithCors(data: unknown, init?: ResponseInit): Response {
	const headers = new Headers(init?.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
	headers.set('Content-Type', 'application/json');
	return new Response(JSON.stringify(data), {
		...init,
		headers
	});
}

export function optionsCors(): Response {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function handleApiOptions(event: RequestEvent): Response | null {
	if (event.request.method === 'OPTIONS') return optionsCors();
	return null;
}
