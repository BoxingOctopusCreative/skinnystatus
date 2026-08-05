import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { textEncoder } from './types';
import type { CloudflareHostCreds } from '$lib/server/host-credentials';

function requireCreds(credentials: DeployInput['credentials']): CloudflareHostCreds {
	const creds = credentials as CloudflareHostCreds;
	if (!creds?.apiToken || !creds?.accountId) {
		throw new Error(
			'Cloudflare credentials missing. Add an API token and account ID under Dashboard → Settings.'
		);
	}
	return { apiToken: creds.apiToken, accountId: creds.accountId };
}

export const cloudflarePagesAdapter: DeployAdapter = {
	provider: 'cloudflare_pages',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { apiToken, accountId } = requireCreds(input.credentials);
		const projectName = `skinnystatus-${input.project.slug}`.slice(0, 58);

		// Ensure project exists
		const getRes = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
			{ headers: { Authorization: `Bearer ${apiToken}` } }
		);

		if (getRes.status === 404) {
			const createRes = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${apiToken}`,
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						name: projectName,
						production_branch: 'main'
					})
				}
			);
			if (!createRes.ok) {
				const text = await createRes.text();
				throw new Error(
					`Cloudflare Pages project create failed (${createRes.status}): ${text.slice(0, 400)}`
				);
			}
		} else if (!getRes.ok) {
			const text = await getRes.text();
			throw new Error(
				`Cloudflare Pages project lookup failed (${getRes.status}): ${text.slice(0, 400)}`
			);
		}

		const form = new FormData();
		const manifest: Record<string, string> = {};

		for (const file of input.files) {
			const path = file.path.replace(/^\//, '');
			const bytes = textEncoder(file.content);
			const hashBuffer = await crypto.subtle.digest('SHA-256', Buffer.from(bytes));
			const hash = [...new Uint8Array(hashBuffer)]
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');
			manifest[`/${path}`] = hash;
			form.append(
				hash,
				new Blob([Buffer.from(bytes)], {
					type: file.contentType ?? 'application/octet-stream'
				}),
				path
			);
		}

		form.append(
			'manifest',
			new Blob([JSON.stringify(manifest)], { type: 'application/json' })
		);

		const deployRes = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${apiToken}` },
				body: form
			}
		);

		if (!deployRes.ok) {
			const text = await deployRes.text();
			throw new Error(
				`Cloudflare Pages deploy failed (${deployRes.status}): ${text.slice(0, 400)}`
			);
		}

		const data = (await deployRes.json()) as {
			result?: { url?: string; id?: string; subdomain?: string };
		};

		let url =
			data.result?.url ??
			`https://${projectName}.pages.dev`;
		if (input.mode === 'path' && input.basePath) {
			url = `${url.replace(/\/$/, '')}${input.basePath}`;
		}

		return {
			url,
			providerId: projectName
		};
	}
};
