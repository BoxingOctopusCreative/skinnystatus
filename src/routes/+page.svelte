<script lang="ts">
	import StatusBoard from '$lib/components/StatusBoard.svelte';
	import MarketingHome from '$lib/components/MarketingHome.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const title = $derived(data.mode === 'board' ? data.page.name : data.site.name);
	const description = $derived(
		data.mode === 'board'
			? data.page.description
			: 'Multi-tenant status pages: monitor, theme, and publish static boards from one admin portal.'
	);
</script>

<svelte:head>
	<title>{title}</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

{#if data.mode === 'board'}
	<StatusBoard {data} />
{:else}
	<MarketingHome />
{/if}
