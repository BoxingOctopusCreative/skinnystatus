import { describe, expect, it } from 'vitest';
import { sanitizeVercelProjectName, vercelProjectName } from './vercel';

describe('sanitizeVercelProjectName', () => {
	it('collapses consecutive hyphens so names never contain ---', () => {
		expect(sanitizeVercelProjectName('skinnystatus-john---doe')).toBe(
			'skinnystatus-john-doe'
		);
		expect(sanitizeVercelProjectName('a--b--c')).toBe('a-b-c');
	});

	it('lowercases and strips invalid characters', () => {
		expect(sanitizeVercelProjectName('Acme Status!')).toBe('acme-status');
	});
});

describe('vercelProjectName', () => {
	it('uses the status page UUID so the name is always valid', () => {
		const id = '550e8400-e29b-41d4-a716-446655440000';
		expect(vercelProjectName({ id, slug: 'john---doe' })).toBe(
			'skinnystatus-550e8400e29b41d4a716446655440000'
		);
	});

	it('falls back to a sanitized slug when id is not a UUID', () => {
		expect(vercelProjectName({ id: 'not-a-uuid', slug: 'a--b' })).toBe(
			'skinnystatus-a-b'
		);
	});

	it('stays within 100 characters and never contains ---', () => {
		const name = vercelProjectName({
			id: '550e8400-e29b-41d4-a716-446655440000',
			slug: 'x'.repeat(120)
		});
		expect(name.length).toBeLessThanOrEqual(100);
		expect(name).not.toMatch(/---/);
	});
});
