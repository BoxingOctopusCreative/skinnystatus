<script lang="ts">
	import { page } from '$app/state';

	let {
		pages,
		pageId
	}: {
		pages: Array<{ id: string; name: string; slug: string }>;
		pageId: string;
	} = $props();

	function hrefFor(id: string) {
		const url = new URL(page.url);
		url.searchParams.set('page', id);
		return `${url.pathname}?${url.searchParams.toString()}`;
	}
</script>

{#if pages.length > 0}
	<label class="label max-w-[280px] mb-4">
		<span class="label-text">Project</span>
		<select
			class="select"
			onchange={(e) => {
				const id = (e.currentTarget as HTMLSelectElement).value;
				window.location.href = hrefFor(id);
			}}
		>
			{#each pages as p (p.id)}
				<option value={p.id} selected={p.id === pageId}>{p.name} ({p.slug})</option>
			{/each}
		</select>
	</label>
{/if}
