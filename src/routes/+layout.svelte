<script lang="ts">
	import { onMount } from 'svelte';
	import { BRAND_FAVICON, BRAND_NAME } from '$lib/brand';
	import { initTheme } from '$lib/theme.svelte';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		initTheme();
	});
</script>

<svelte:head>
	<link rel="icon" href={BRAND_FAVICON} type="image/png" />
	<link rel="apple-touch-icon" href={BRAND_FAVICON} />
	<meta name="application-name" content={BRAND_NAME} />
</svelte:head>

{@render children()}
