import {
	cnameTargetForProvider,
	subdomainHostname,
	type HostProvider,
	type StatusPageInfo
} from '$lib/publishing';
import type {
	CloudflareHostCreds,
	GitHubHostCreds,
	HostCredentials,
	NetlifyHostCreds,
	VercelHostCreds
} from '$lib/server/host-credentials';

export type DomainRegisterResult = {
	hostname: string;
	verified: boolean;
	cnameTarget: string;
};

export type DomainRegisterInput = {
	provider: HostProvider;
	hostname: string;
	providerId: string;
	credentials: HostCredentials;
	deployUrl?: string;
};

function teamQuery(teamId: string | null | undefined): string {
	return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

function isAlreadyConfiguredError(status: number, body: string): boolean {
	if (status !== 400 && status !== 409 && status !== 422) return false;
	const lower = body.toLowerCase();
	return (
		lower.includes('already') ||
		lower.includes('exist') ||
		lower.includes('taken') ||
		lower.includes('conflict')
	);
}

async function registerVercelDomain(input: DomainRegisterInput): Promise<DomainRegisterResult> {
	const creds = input.credentials as VercelHostCreds;
	const token = creds.token;
	const teamId = creds.teamId ?? null;
	const projectId = input.providerId;
	const q = teamQuery(teamId);

	const getRes = await fetch(
		`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(input.hostname)}${q}`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);

	if (getRes.ok) {
		const existing = (await getRes.json()) as { verified?: boolean };
		return {
			hostname: input.hostname,
			verified: Boolean(existing.verified),
			cnameTarget: cnameTargetForProvider('vercel')
		};
	}

	const addRes = await fetch(
		`https://api.vercel.com/v10/projects/${encodeURIComponent(projectId)}/domains${q}`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ name: input.hostname })
		}
	);

	const text = await addRes.text();
	if (!addRes.ok && !isAlreadyConfiguredError(addRes.status, text)) {
		throw new Error(`Vercel domain registration failed (${addRes.status}): ${text.slice(0, 400)}`);
	}

	let verified = false;
	if (addRes.ok) {
		try {
			const data = JSON.parse(text) as { verified?: boolean };
			verified = Boolean(data.verified);
		} catch {
			verified = false;
		}
	} else {
		const retry = await fetch(
			`https://api.vercel.com/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(input.hostname)}${q}`,
			{ headers: { Authorization: `Bearer ${token}` } }
		);
		if (retry.ok) {
			const data = (await retry.json()) as { verified?: boolean };
			verified = Boolean(data.verified);
		}
	}

	return {
		hostname: input.hostname,
		verified,
		cnameTarget: cnameTargetForProvider('vercel')
	};
}

async function registerCloudflarePagesDomain(
	input: DomainRegisterInput
): Promise<DomainRegisterResult> {
	const creds = input.credentials as CloudflareHostCreds;
	const { apiToken, accountId } = creds;
	const projectName = input.providerId;
	const cnameTarget = cnameTargetForProvider('cloudflare_pages', {
		deployProviderId: projectName
	});
	const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${encodeURIComponent(projectName)}/domains`;

	const listRes = await fetch(base, {
		headers: { Authorization: `Bearer ${apiToken}` }
	});
	if (listRes.ok) {
		const list = (await listRes.json()) as {
			result?: Array<{ name?: string; status?: string }>;
		};
		const found = list.result?.find(
			(d) => d.name?.toLowerCase() === input.hostname.toLowerCase()
		);
		if (found) {
			return {
				hostname: input.hostname,
				verified: found.status === 'active',
				cnameTarget
			};
		}
	}

	const addRes = await fetch(base, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ name: input.hostname })
	});

	const text = await addRes.text();
	if (!addRes.ok && !isAlreadyConfiguredError(addRes.status, text)) {
		throw new Error(
			`Cloudflare Pages domain registration failed (${addRes.status}): ${text.slice(0, 400)}`
		);
	}

	let verified = false;
	if (addRes.ok) {
		try {
			const data = JSON.parse(text) as { result?: { status?: string } };
			verified = data.result?.status === 'active';
		} catch {
			verified = false;
		}
	}

	return { hostname: input.hostname, verified, cnameTarget };
}

async function registerNetlifyDomain(input: DomainRegisterInput): Promise<DomainRegisterResult> {
	const creds = input.credentials as NetlifyHostCreds;
	const token = creds.token;
	const siteId = input.providerId;

	const getRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!getRes.ok) {
		const text = await getRes.text();
		throw new Error(`Netlify site lookup failed (${getRes.status}): ${text.slice(0, 400)}`);
	}

	const site = (await getRes.json()) as {
		custom_domain?: string | null;
		ssl_url?: string;
		url?: string;
		name?: string;
	};

	const cnameTarget =
		site.name != null && site.name.length > 0
			? `${site.name}.netlify.app`
			: cnameTargetForProvider('netlify', {
					deployUrl: input.deployUrl ?? site.ssl_url ?? site.url ?? undefined
				});

	if (site.custom_domain?.toLowerCase() === input.hostname.toLowerCase()) {
		return { hostname: input.hostname, verified: true, cnameTarget };
	}

	const patchRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
		method: 'PATCH',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ custom_domain: input.hostname })
	});

	const text = await patchRes.text();
	if (!patchRes.ok && !isAlreadyConfiguredError(patchRes.status, text)) {
		throw new Error(`Netlify domain registration failed (${patchRes.status}): ${text.slice(0, 400)}`);
	}

	return {
		hostname: input.hostname,
		verified: false,
		cnameTarget
	};
}

async function registerGitHubPagesDomain(
	input: DomainRegisterInput
): Promise<DomainRegisterResult> {
	const creds = input.credentials as GitHubHostCreds;
	const { token, owner } = creds;
	const providerId = input.providerId;
	const repo = providerId.includes('/') ? providerId.split('/')[1]! : providerId;
	const cnameTarget = cnameTargetForProvider('github_pages', {
		deployProviderId: `${owner}/${repo}`
	});

	const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pages`, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'SkinnyStatus',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ cname: input.hostname })
	});

	const text = await res.text();
	if (!res.ok && res.status !== 204 && !isAlreadyConfiguredError(res.status, text)) {
		throw new Error(
			`GitHub Pages domain registration failed (${res.status}): ${text.slice(0, 400)}`
		);
	}

	return { hostname: input.hostname, verified: false, cnameTarget };
}

const DOMAIN_REGISTRARS: Partial<
	Record<HostProvider, (input: DomainRegisterInput) => Promise<DomainRegisterResult>>
> = {
	vercel: registerVercelDomain,
	cloudflare_pages: registerCloudflarePagesDomain,
	netlify: registerNetlifyDomain,
	github_pages: registerGitHubPagesDomain
};

export function supportsCustomDomainRegistration(provider: HostProvider): boolean {
	return Boolean(DOMAIN_REGISTRARS[provider]);
}

/**
 * Register `{slug}.{publishBaseDomain}` on the host after a successful deploy.
 * Returns null when the provider has no domain API, or when subdomain mode is unset.
 */
export async function registerCustomDomain(
	input: DomainRegisterInput
): Promise<DomainRegisterResult | null> {
	const register = DOMAIN_REGISTRARS[input.provider];
	if (!register) return null;
	return register(input);
}

/** Build domain registration input from a deployed status page, or null if not applicable. */
export function domainRegisterInputForProject(
	project: Pick<StatusPageInfo, 'publishMode' | 'publishBaseDomain' | 'slug' | 'hostProvider'>,
	deploy: { providerId: string; url: string },
	credentials: HostCredentials
): DomainRegisterInput | null {
	if (project.publishMode !== 'subdomain' || !project.publishBaseDomain) return null;
	if (!supportsCustomDomainRegistration(project.hostProvider)) return null;
	return {
		provider: project.hostProvider,
		hostname: subdomainHostname(project.slug, project.publishBaseDomain),
		providerId: deploy.providerId,
		credentials,
		deployUrl: deploy.url
	};
}
