import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { textEncoder } from './types';
import type { NetlifyHostCreds } from '$lib/server/host-credentials';

function requireToken(credentials: DeployInput['credentials']): string {
	const creds = credentials as NetlifyHostCreds;
	if (!creds?.token) {
		throw new Error('Netlify credentials missing. Add a token under Dashboard → Settings.');
	}
	return creds.token;
}

async function ensureSite(
	token: string,
	slug: string,
	existingId: string | null
): Promise<{ id: string; url: string }> {
	if (existingId) {
		const res = await fetch(`https://api.netlify.com/api/v1/sites/${existingId}`, {
			headers: { Authorization: `Bearer ${token}` }
		});
		if (res.ok) {
			const site = (await res.json()) as { id: string; ssl_url?: string; url?: string };
			return { id: site.id, url: site.ssl_url ?? site.url ?? '' };
		}
	}

	const name = `skinnystatus-${slug}`.slice(0, 63);
	const create = await fetch('https://api.netlify.com/api/v1/sites', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ name })
	});

	if (!create.ok) {
		const text = await create.text();
		throw new Error(`Netlify site create failed (${create.status}): ${text.slice(0, 400)}`);
	}

	const site = (await create.json()) as { id: string; ssl_url?: string; url?: string };
	return { id: site.id, url: site.ssl_url ?? site.url ?? '' };
}

/** Minimal ZIP (store only) for Netlify file deploy via digest API alternative: use deploy with files hash. */
async function sha1Hex(bytes: Uint8Array): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-1', Buffer.from(bytes));
	return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const netlifyAdapter: DeployAdapter = {
	provider: 'netlify',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const token = requireToken(input.credentials);
		const site = await ensureSite(token, input.project.slug, input.providerId);

		const files: Record<string, string> = {};
		const contents = new Map<string, Uint8Array>();

		for (const file of input.files) {
			const path = `/${file.path.replace(/^\//, '')}`;
			const bytes = textEncoder(file.content);
			const sha = await sha1Hex(bytes);
			files[path] = sha;
			contents.set(sha, bytes);
		}

		const createDeploy = await fetch(
			`https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ files })
			}
		);

		if (!createDeploy.ok) {
			const text = await createDeploy.text();
			throw new Error(
				`Netlify deploy create failed (${createDeploy.status}): ${text.slice(0, 400)}`
			);
		}

		const deploy = (await createDeploy.json()) as {
			id: string;
			ssl_url?: string;
			url?: string;
			required?: string[];
		};

		const required = deploy.required ?? [];
		for (const sha of required) {
			const bytes = contents.get(sha);
			if (!bytes) continue;
			const put = await fetch(
				`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${sha}`,
				{
					method: 'PUT',
					headers: {
						Authorization: `Bearer ${token}`,
						'Content-Type': 'application/octet-stream'
					},
					body: Buffer.from(bytes)
				}
			);
			if (!put.ok) {
				const text = await put.text();
				throw new Error(
					`Netlify file upload failed (${put.status}): ${text.slice(0, 400)}`
				);
			}
		}

		let url = deploy.ssl_url ?? deploy.url ?? site.url;
		if (!url) throw new Error('Netlify deploy returned no URL');
		if (input.mode === 'path' && input.basePath) {
			url = `${url.replace(/\/$/, '')}${input.basePath}`;
		}

		return { url, providerId: site.id };
	}
};
