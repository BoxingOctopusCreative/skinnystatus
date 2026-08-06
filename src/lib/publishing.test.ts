import { describe, expect, it } from 'vitest';
import {
	isValidPublishPathPrefix,
	normalizePublishBaseDomain,
	normalizePublishPathPrefix
} from '$lib/publishing';

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
