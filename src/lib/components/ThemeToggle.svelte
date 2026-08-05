<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { themeState, toggleTheme } from '$lib/theme.svelte';

	const isDark = $derived(themeState.value === 'dark');
	const label = $derived(isDark ? 'Switch to light mode' : 'Switch to dark mode');
</script>

<button
	type="button"
	class="btn-icon {isDark
		? 'preset-filled-primary-500'
		: 'preset-outlined-secondary-500'}"
	aria-label={label}
	onclick={toggleTheme}
>
	{#if isDark}
		<Sun size={16} strokeWidth={2} aria-hidden="true" />
	{:else}
		<Moon size={16} strokeWidth={2} aria-hidden="true" />
	{/if}
</button>
