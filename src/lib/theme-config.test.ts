import { describe, expect, it } from 'vitest';
import { parsePageTheme, serializePageTheme, DEFAULT_PAGE_THEME } from '$lib/theme-config';
import { pageInfoFromRow, isHostProvider } from '$lib/publishing';

describe('theme-config', () => {
	it('returns defaults for empty input', () => {
		expect(parsePageTheme(null).colors.accent).toBe(DEFAULT_PAGE_THEME.colors.accent);
	});

	it('round-trips theme JSON', () => {
		const theme = { ...DEFAULT_PAGE_THEME, brandName: 'Acme' };
		expect(parsePageTheme(serializePageTheme(theme)).brandName).toBe('Acme');
	});
});

describe('pageInfoFromRow', () => {
	it('normalizes host provider and theme', () => {
		const info = pageInfoFromRow({
			id: '1',
			slug: 'acme',
			name: 'Acme',
			description: null,
			publishMode: 'path',
			hostProvider: 'netlify',
			themeJson: serializePageTheme({ ...DEFAULT_PAGE_THEME, brandName: 'Acme' })
		});
		expect(info.hostProvider).toBe('netlify');
		expect(info.theme.brandName).toBe('Acme');
		expect(isHostProvider('vercel')).toBe(true);
		expect(isHostProvider('nope')).toBe(false);
	});
});
