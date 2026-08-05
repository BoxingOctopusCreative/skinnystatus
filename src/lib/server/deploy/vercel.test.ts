import { describe, expect, it } from 'vitest';
import { vercelProjectName } from './vercel';

describe('vercelProjectName', () => {
	it('prefixes the slug', () => {
		expect(vercelProjectName('acme')).toBe('skinnystatus-acme');
	});

	it('collapses consecutive hyphens so names never contain ---', () => {
		expect(vercelProjectName('john---doe')).toBe('skinnystatus-john-doe');
		expect(vercelProjectName('a--b--c')).toBe('skinnystatus-a-b-c');
	});

	it('lowercases and strips invalid characters', () => {
		expect(vercelProjectName('Acme Status!')).toBe('skinnystatus-acme-status');
	});

	it('stays within 100 characters', () => {
		const long = 'a'.repeat(120);
		expect(vercelProjectName(long).length).toBeLessThanOrEqual(100);
		expect(vercelProjectName(long)).not.toMatch(/---/);
	});
});
