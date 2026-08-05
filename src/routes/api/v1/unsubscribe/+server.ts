import type { RequestHandler } from './$types';
import { unsubscribeByToken } from '$lib/server/subscriptions';

export const GET: RequestHandler = async ({ url }) => {
	const token = url.searchParams.get('token')?.trim() ?? '';
	const ok = token ? await unsubscribeByToken(token) : false;

	const title = ok ? 'Unsubscribed' : 'Link invalid';
	const body = ok
		? 'You will no longer receive status alerts for this page.'
		: 'This unsubscribe link is invalid or already used.';

	return new Response(
		`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${title}</title>
	<style>
		body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; color: #040404; background: #f4f5f4; }
		a { color: #1ca048; }
	</style>
</head>
<body>
	<h1>${title}</h1>
	<p>${body}</p>
	<p><a href="/">Back to home</a></p>
</body>
</html>`,
		{
			status: ok ? 200 : 400,
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		}
	);
};
