export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'skinnystatus-theme';

export const themeState = $state({
	value: 'dark' as Theme
});

function apply(theme: Theme): void {
	themeState.value = theme;
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.mode = theme;
	document.documentElement.dataset.theme = 'skinnystatus';
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		/* ignore */
	}
}

export function initTheme(): void {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.theme = 'skinnystatus';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'dark' || stored === 'light') {
			apply(stored);
			return;
		}
	} catch {
		/* ignore */
	}
	apply('dark');
}

export function setTheme(theme: Theme): void {
	apply(theme);
}

export function toggleTheme(): void {
	apply(themeState.value === 'dark' ? 'light' : 'dark');
}
