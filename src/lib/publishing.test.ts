import { describe, expect, it } from 'vitest';
import {
	isValidPublishPathPrefix,
	isValidSlug,
	cnameTargetForProvider,
	defaultCnameTarget,
	normalizePublishBaseDomain,
	normalizePublishPathPrefix,
	slugValidationMessage,
	subdomainHostname
} from '$lib/publishing';

describe('slug validation', () => {
	it('accepts simple slugs', () => {
		expect(isValidSlug('acme')).toBe(true);
		expect(isValidSlug('acme-status')).toBe(true);
		expect(slugValidationMessage('acme')).toBeNull();
	});

	it('rejects length, unsupported characters, and consecutive hyphens', () => {
		expect(slugValidationMessage('x'.repeat(64))).toMatch(/63 characters/);
		expect(slugValidationMessage('Acme')).toMatch(/lowercase/);
		expect(slugValidationMessage('acme_status')).toMatch(/letters, digits, and hyphens/);
		expect(slugValidationMessage('john---doe')).toMatch(/consecutive hyphens/);
		expect(slugValidationMessage('-acme')).toMatch(/start and end/);
		expect(isValidSlug('a--b')).toBe(false);
	});
});

describe('publish path prefix', () => {
	it('accepts simple prefixes', () => {
		expect(isValidPublishPathPrefix('s')).toBe(true);
		expect(isValidPublishPathPrefix('status')).toBe(true);
		expect(normalizePublishPathPrefix('/Status/')).toBe('status');
	});

	it('rejects invalid prefixes', () => {
		expect(isValidPublishPathPrefix('')).toBe(false);
		expect(isValidPublishPathPrefix('a--b')).toBe(false);
		expect(() => normalizePublishPathPrefix('Bad/Path')).toThrow(/Path prefix/);
	});
});

describe('publish base domain', () => {
	it('normalizes hostnames', () => {
		expect(normalizePublishBaseDomain('https://Status.Example.com/')).toBe('status.example.com');
		expect(normalizePublishBaseDomain('')).toBe(null);
		expect(normalizePublishBaseDomain('  ')).toBe(null);
	});

	it('rejects junk and strips paths to the host', () => {
		expect(normalizePublishBaseDomain('example.com/foo')).toBe('example.com');
		expect(() => normalizePublishBaseDomain('not a domain')).toThrow(/hostname/);
	});
});

describe('subdomainHostname', () => {
	it('joins slug and apex', () => {
		expect(subdomainHostname('acme', 'status.example.com')).toBe('acme.status.example.com');
	});

	it('rejects empty parts', () => {
		expect(() => subdomainHostname('', 'example.com')).toThrow(/required/);
		expect(() => subdomainHostname('acme', '')).toThrow(/required/);
	});
});

describe('cname targets', () => {
	it('returns provider defaults', () => {
		expect(defaultCnameTarget('vercel')).toBe('cname.vercel-dns.com');
		expect(defaultCnameTarget('cloudflare_pages')).toBe('<project>.pages.dev');
		expect(defaultCnameTarget('netlify')).toBe('<site>.netlify.app');
		expect(defaultCnameTarget('github_pages')).toBe('<owner>.github.io');
	});

	it('resolves concrete targets when ids are known', () => {
		expect(
			cnameTargetForProvider('cloudflare_pages', {
				deployProviderId: 'skinnystatus-acme'
			})
		).toBe('skinnystatus-acme.pages.dev');
		expect(
			cnameTargetForProvider('netlify', {
				deployUrl: 'https://skinnystatus-acme.netlify.app/'
			})
		).toBe('skinnystatus-acme.netlify.app');
		expect(
			cnameTargetForProvider('github_pages', {
				deployProviderId: 'acme-org/skinnystatus-status'
			})
		).toBe('acme-org.github.io');
		expect(cnameTargetForProvider('vercel', {})).toBe('cname.vercel-dns.com');
	});
});
