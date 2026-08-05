<script lang="ts">
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let {
		data
	}: {
		data: {
			page: { name: string };
			basePath: string;
			incident: {
				title: string;
				status: string;
				impact: string;
				createdAt: Date | string;
				resolvedAt: Date | string | null;
			};
			updates: Array<{
				id: string;
				status: string;
				body: string;
				createdAt: Date | string;
			}>;
			affected: Array<{ name: string }>;
		};
	} = $props();

	function formatDate(value: Date | string | null | undefined): string {
		if (!value) return '';
		return new Date(value).toLocaleString();
	}
</script>

<svelte:head>
	<title>{data.incident.title} · {data.page.name}</title>
</svelte:head>

<div class="mx-auto w-[min(880px,calc(100%-2rem))]">
	<header
		class="flex justify-between items-center gap-4 pt-7 pb-5 border-b border-surface-200-800 mb-6"
	>
		<div>
			<a class="text-2xl font-bold tracking-tight no-underline" href={data.basePath || '/'}>
				{data.page.name}
			</a>
			<p class="text-surface-500 text-sm mt-1 m-0">Incident</p>
		</div>
		<div class="flex items-center gap-3">
			<ThemeToggle />
			<a href={data.basePath || '/'} class="text-sm font-medium">&larr; Status</a>
		</div>
	</header>

	<article class="mb-8">
		<h1 class="text-2xl font-bold m-0 mb-1">{data.incident.title}</h1>
		<p class="text-surface-500 text-sm m-0">
			{data.incident.status} · {data.incident.impact} impact · opened
			{formatDate(data.incident.createdAt)}
			{#if data.incident.resolvedAt}
				· resolved {formatDate(data.incident.resolvedAt)}
			{/if}
		</p>

		{#if data.affected.length > 0}
			<p class="text-surface-500 text-sm m-0 mt-3">
				Affected: {data.affected.map((c) => c.name).join(', ')}
			</p>
		{/if}
	</article>

	<section class="mb-8">
		<h2 class="text-sm uppercase tracking-[0.04em] text-surface-500 m-0 mb-3">Updates</h2>
		{#each data.updates as update (update.id)}
			<article class="py-3 border-b border-surface-200-800">
				<p class="text-surface-500 text-sm m-0 mb-1">{update.status} · {formatDate(update.createdAt)}</p>
				<p class="m-0">{update.body}</p>
			</article>
		{:else}
			<p class="text-surface-500">No updates yet.</p>
		{/each}
	</section>
</div>
