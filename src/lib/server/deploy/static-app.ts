import type { DeployAdapter, DeployInput, DeployResult } from './types';
import type { StaticAppHostCreds } from '$lib/server/host-credentials';
import { zipDeployFiles } from './zip';

function requireCreds(credentials: DeployInput['credentials']): StaticAppHostCreds {
	const creds = credentials as StaticAppHostCreds;
	if (!creds?.apiKey) {
		throw new Error(
			'static.app credentials missing. Add an API key under Dashboard → Settings.'
		);
	}
	return { apiKey: creds.apiKey };
}

function joinUrl(base: string, basePath: string): string {
	const root = base.replace(/\/$/, '');
	if (!basePath) return root;
	return `${root}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

export const staticAppAdapter: DeployAdapter = {
	provider: 'static_app',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { apiKey } = requireCreds(input.credentials);
		const zip = zipDeployFiles(input.files);

		const form = new FormData();
		form.append(
			'archive',
			new Blob([Buffer.from(zip)], { type: 'application/zip' }),
			'site.zip'
		);
		if (input.providerId) {
			form.append('pid', input.providerId);
		}

		const res = await fetch('https://api.static.app/v1/sites/zip', {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}` },
			body: form
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`static.app deploy failed (${res.status}): ${text.slice(0, 400)}`);
		}

		const data = (await res.json()) as {
			pid?: string;
			url?: string;
			site_url?: string;
			domain?: string;
			data?: {
				pid?: string;
				url?: string;
				site_url?: string;
				domain?: string;
			};
		};

		const nested = data.data ?? data;
		const pid = nested.pid ?? input.providerId;
		const rawUrl =
			nested.url ??
			nested.site_url ??
			(nested.domain
				? nested.domain.startsWith('http')
					? nested.domain
					: `https://${nested.domain}`
				: null);

		if (!rawUrl) {
			throw new Error('static.app deploy succeeded but returned no URL');
		}
		if (!pid) {
			throw new Error('static.app deploy succeeded but returned no site pid');
		}

		const url = joinUrl(rawUrl, input.mode === 'path' ? input.basePath : '');
		return { url, providerId: pid };
	}
};
