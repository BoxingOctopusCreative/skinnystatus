import { BRAND_COLORS, BRAND_LOGO_WIDE } from '$lib/brand';

export const HOST_PROVIDERS = [
	'vercel',
	'cloudflare_pages',
	'netlify',
	'github_pages',
	'static_app',
	'amazon_s3',
	'firebase_hosting',
	'azure_static_web_apps'
] as const;

export type HostProvider = (typeof HOST_PROVIDERS)[number];

export function isHostProvider(value: string): value is HostProvider {
	return (HOST_PROVIDERS as readonly string[]).includes(value);
}

export type PageThemeColors = {
	bg: string;
	ink: string;
	accent: string;
	ok: string;
	warn: string;
	bad: string;
	muted: string;
	line: string;
};

export type PageTheme = {
	brandName: string;
	logoUrl: string;
	fontFamily: string;
	colors: PageThemeColors;
};

export const DEFAULT_PAGE_THEME: PageTheme = {
	brandName: '',
	logoUrl: BRAND_LOGO_WIDE,
	fontFamily: "'Jost', 'Segoe UI', sans-serif",
	colors: {
		bg: BRAND_COLORS.black,
		ink: BRAND_COLORS.white,
		accent: BRAND_COLORS.green,
		ok: BRAND_COLORS.green,
		warn: '#f59e0b',
		bad: '#ef4444',
		muted: BRAND_COLORS.greyMuted,
		line: BRAND_COLORS.grey
	}
};

export function parsePageTheme(raw: string | null | undefined): PageTheme {
	if (!raw) return structuredClone(DEFAULT_PAGE_THEME);
	try {
		const parsed = JSON.parse(raw) as Partial<PageTheme>;
		return {
			brandName: typeof parsed.brandName === 'string' ? parsed.brandName : '',
			logoUrl: typeof parsed.logoUrl === 'string' ? parsed.logoUrl : '',
			fontFamily:
				typeof parsed.fontFamily === 'string' && parsed.fontFamily
					? parsed.fontFamily
					: DEFAULT_PAGE_THEME.fontFamily,
			colors: {
				...DEFAULT_PAGE_THEME.colors,
				...(parsed.colors && typeof parsed.colors === 'object' ? parsed.colors : {})
			}
		};
	} catch {
		return structuredClone(DEFAULT_PAGE_THEME);
	}
}

export function serializePageTheme(theme: PageTheme): string {
	return JSON.stringify(theme);
}

export function themeFromForm(form: FormData): PageTheme {
	return {
		brandName: form.get('themeBrandName')?.toString().trim() ?? '',
		logoUrl: form.get('themeLogoUrl')?.toString().trim() ?? '',
		fontFamily:
			form.get('themeFontFamily')?.toString().trim() || DEFAULT_PAGE_THEME.fontFamily,
		colors: {
			bg: form.get('themeColorBg')?.toString().trim() || DEFAULT_PAGE_THEME.colors.bg,
			ink: form.get('themeColorInk')?.toString().trim() || DEFAULT_PAGE_THEME.colors.ink,
			accent:
				form.get('themeColorAccent')?.toString().trim() || DEFAULT_PAGE_THEME.colors.accent,
			ok: form.get('themeColorOk')?.toString().trim() || DEFAULT_PAGE_THEME.colors.ok,
			warn: form.get('themeColorWarn')?.toString().trim() || DEFAULT_PAGE_THEME.colors.warn,
			bad: form.get('themeColorBad')?.toString().trim() || DEFAULT_PAGE_THEME.colors.bad,
			muted:
				form.get('themeColorMuted')?.toString().trim() || DEFAULT_PAGE_THEME.colors.muted,
			line: form.get('themeColorLine')?.toString().trim() || DEFAULT_PAGE_THEME.colors.line
		}
	};
}
