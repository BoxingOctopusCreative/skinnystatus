<script lang="ts">
	import StatusPageLive from '$lib/components/StatusPageLive.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Preview · {data.project.name}</title>
</svelte:head>

<StatusPageLive
	apiBase={data.apiBase}
	pageSlug={data.project.slug}
	theme={data.project.theme}
	preview={true}
/>
