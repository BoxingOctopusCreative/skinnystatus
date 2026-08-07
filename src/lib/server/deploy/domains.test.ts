import { describe, expect, it, vi, afterEach } from 'vitest';
import {
	domainRegisterInputForProject,
	registerCustomDomain,
	supportsCustomDomainRegistration
} from './domains';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('supportsCustomDomainRegistration', () => {
	it('covers first-pass providers', () => {
		expect(supportsCustomDomainRegistration('vercel')).toBe(true);
		expect(supportsCustomDomainRegistration('cloudflare_pages')).toBe(true);
		expect(supportsCustomDomainRegistration('netlify')).toBe(true);
		expect(supportsCustomDomainRegistration('github_pages')).toBe(true);
		expect(supportsCustomDomainRegistration('amazon_s3')).toBe(false);
		expect(supportsCustomDomainRegistration('azure_static_web_apps')).toBe(false);
	});
});

describe('domainRegisterInputForProject', () => {
	const base = {
		slug: 'acme',
		publishBaseDomain: 'status.example.com',
		hostProvider: 'vercel' as const
	};

	it('returns null for path mode', () => {
		expect(
			domainRegisterInputForProject(
				{ ...base, publishMode: 'path' },
				{ providerId: 'prj_1', url: 'https://x.vercel.app' },
				{ token: 't' }
			)
		).toBeNull();
	});

	it('returns null without a base domain', () => {
		expect(
			domainRegisterInputForProject(
				{ ...base, publishMode: 'subdomain', publishBaseDomain: null },
				{ providerId: 'prj_1', url: 'https://x.vercel.app' },
				{ token: 't' }
			)
		).toBeNull();
	});

	it('builds input for subdomain mode', () => {
		expect(
			domainRegisterInputForProject(
				{ ...base, publishMode: 'subdomain' },
				{ providerId: 'prj_abc', url: 'https://x.vercel.app' },
				{ token: 'tok', teamId: 'team_1' }
			)
		).toEqual({
			provider: 'vercel',
			hostname: 'acme.status.example.com',
			providerId: 'prj_abc',
			credentials: { token: 'tok', teamId: 'team_1' },
			deployUrl: 'https://x.vercel.app'
		});
	});
});

describe('registerCustomDomain', () => {
	it('adds a Vercel project domain', async () => {
		const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
			const href = String(url);
			if (href.includes('/v9/projects/') && init?.method == null) {
				return new Response('Not found', { status: 404 });
			}
			if (href.includes('/v10/projects/') && init?.method === 'POST') {
				return Response.json({ name: 'acme.status.example.com', verified: false });
			}
			throw new Error(`Unexpected fetch: ${href} ${init?.method}`);
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await registerCustomDomain({
			provider: 'vercel',
			hostname: 'acme.status.example.com',
			providerId: 'prj_abc',
			credentials: { token: 'tok' }
		});

		expect(result).toEqual({
			hostname: 'acme.status.example.com',
			verified: false,
			cnameTarget: 'cname.vercel-dns.com'
		});
		expect(fetchMock).toHaveBeenCalled();
	});

	it('treats an existing Vercel domain as success', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () =>
				Response.json({ name: 'acme.status.example.com', verified: true })
			)
		);

		const result = await registerCustomDomain({
			provider: 'vercel',
			hostname: 'acme.status.example.com',
			providerId: 'prj_abc',
			credentials: { token: 'tok', teamId: 'team_1' }
		});

		expect(result?.verified).toBe(true);
	});

	it('adds a Cloudflare Pages domain', async () => {
		const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
			if (!init?.method || init.method === 'GET') {
				return Response.json({ result: [] });
			}
			return Response.json({
				result: { name: 'acme.status.example.com', status: 'pending' }
			});
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await registerCustomDomain({
			provider: 'cloudflare_pages',
			hostname: 'acme.status.example.com',
			providerId: 'skinnystatus-acme',
			credentials: { apiToken: 'tok', accountId: 'acct' }
		});

		expect(result).toEqual({
			hostname: 'acme.status.example.com',
			verified: false,
			cnameTarget: 'skinnystatus-acme.pages.dev'
		});
	});

	it('patches Netlify custom_domain', async () => {
		const fetchMock = vi.fn(async (_url: string | URL, init?: RequestInit) => {
			if (!init?.method || init.method === 'GET') {
				return Response.json({
					id: 'site-1',
					name: 'skinnystatus-acme',
					custom_domain: null,
					ssl_url: 'https://skinnystatus-acme.netlify.app'
				});
			}
			return Response.json({
				id: 'site-1',
				custom_domain: 'acme.status.example.com'
			});
		});
		vi.stubGlobal('fetch', fetchMock);

		const result = await registerCustomDomain({
			provider: 'netlify',
			hostname: 'acme.status.example.com',
			providerId: 'site-1',
			credentials: { token: 'tok' }
		});

		expect(result).toEqual({
			hostname: 'acme.status.example.com',
			verified: false,
			cnameTarget: 'skinnystatus-acme.netlify.app'
		});
	});

	it('sets GitHub Pages cname', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));

		const result = await registerCustomDomain({
			provider: 'github_pages',
			hostname: 'acme.status.example.com',
			providerId: 'acme-org/skinnystatus-acme',
			credentials: { token: 'tok', owner: 'acme-org' }
		});

		expect(result).toEqual({
			hostname: 'acme.status.example.com',
			verified: false,
			cnameTarget: 'acme-org.github.io'
		});
	});

	it('returns null for unsupported providers', async () => {
		const result = await registerCustomDomain({
			provider: 'amazon_s3',
			hostname: 'acme.status.example.com',
			providerId: 'bucket',
			credentials: {
				accessKeyId: 'a',
				secretAccessKey: 'b',
				bucket: 'b',
				region: 'us-east-1',
				publicBaseUrl: 'https://cdn.example.com'
			}
		});
		expect(result).toBeNull();
	});
});
