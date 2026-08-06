import { describe, expect, it } from 'vitest';
import {
	assertValidVercelProjectName,
	sanitizeVercelProjectName,
	vercelProjectName,
	vercelProjectNameError,
	VERCEL_PROJECT_NAME_MAX
} from './vercel';

describe('sanitizeVercelProjectName', () => {
	it('collapses consecutive hyphens so names never contain ---', () => {
		expect(sanitizeVercelProjectName('ss-john---doe')).toBe('ss-john-doe');
		expect(sanitizeVercelProjectName('a--b--c')).toBe('a-b-c');
	});

	it('lowercases, strips invalid characters, and caps length', () => {
		expect(sanitizeVercelProjectName('Acme Status!')).toBe('acme-status');
		expect(sanitizeVercelProjectName('x'.repeat(80)).length).toBeLessThanOrEqual(
			VERCEL_PROJECT_NAME_MAX
		);
	});
});

describe('vercelProjectNameError', () => {
	it('rejects length over the deploy budget', () => {
		expect(vercelProjectNameError('x'.repeat(VERCEL_PROJECT_NAME_MAX + 1))).toMatch(
			/up to 40 characters/
		);
	});

	it('rejects unsupported characters', () => {
		expect(vercelProjectNameError('acme status')).toMatch(/letters, digits/);
		expect(vercelProjectNameError('Acme')).toMatch(/lowercase/);
	});

	it('rejects the --- sequence', () => {
		expect(vercelProjectNameError('ss-john---doe')).toMatch(/---`/);
	});

	it('accepts valid names', () => {
		expect(vercelProjectNameError('ss-550e8400e29b41d4a716446655440000')).toBeNull();
		expect(() =>
			assertValidVercelProjectName('ss-550e8400e29b41d4a716446655440000')
		).not.toThrow();
	});
});

describe('vercelProjectName', () => {
	it('uses a short ss- prefix plus UUID hex (35 chars)', () => {
		const id = '550e8400-e29b-41d4-a716-446655440000';
		expect(vercelProjectName({ id, slug: 'john---doe' })).toBe(
			'ss-550e8400e29b41d4a716446655440000'
		);
		expect(vercelProjectName({ id }).length).toBe(35);
	});

	it('falls back to a sanitized slug when id is not a UUID', () => {
		expect(vercelProjectName({ id: 'not-a-uuid', slug: 'a--b' })).toBe('ss-a-b');
	});

	it('stays within the length budget and never contains ---', () => {
		const name = vercelProjectName({
			id: '550e8400-e29b-41d4-a716-446655440000',
			slug: 'x'.repeat(120)
		});
		expect(name.length).toBeLessThanOrEqual(VERCEL_PROJECT_NAME_MAX);
		expect(name).not.toMatch(/---/);
		expect(vercelProjectNameError(name)).toBeNull();
	});
});
