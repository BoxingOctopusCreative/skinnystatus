import { describe, expect, it } from 'vitest';
import {
	isValidPublishPathPrefix,
	isValidSlug,
	normalizePublishBaseDomain,
	normalizePublishPathPrefix,
	slugValidationMessage
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
