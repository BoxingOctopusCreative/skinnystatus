<script lang="ts">
	import type { Snippet } from 'svelte';
	import AnimatedGridShell from '$lib/components/AnimatedGridShell.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME } from '$lib/brand';

	let {
		title,
		description,
		updated,
		eyebrow = 'Legal',
		children
	}: {
		title: string;
		description: string;
		updated?: string;
		eyebrow?: string;
		children: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} · {BRAND_NAME}</title>
	<meta name="description" content={description} />
</svelte:head>

<AnimatedGridShell>
	<div class="relative z-10 mx-auto w-[min(720px,calc(100%-2rem))] py-12 pb-16">
		<a class="inline-block mb-8 leading-none" href="/" aria-label={BRAND_NAME}>
			<img
				src={BRAND_LOGO_WIDE}
				alt={BRAND_NAME}
				width="220"
				height="44"
				class="h-9 w-auto block"
			/>
		</a>
		<article class="card preset-filled-surface-100-900 p-6 sm:p-8 border border-surface-200-800">
			<p
				class="font-mono-status text-[0.75rem] tracking-[0.08em] uppercase text-primary-500 mt-0 mb-3"
			>
				{eyebrow}
			</p>
			<h1
				class="text-2xl sm:text-3xl font-bold tracking-[-0.03em] mt-0 {updated
					? 'mb-2'
					: 'mb-8'}"
			>
				{title}
			</h1>
			{#if updated}
				<p class="text-sm text-surface-500 mb-8">Last updated: {updated}</p>
			{/if}
			<div class="legal-prose text-sm leading-relaxed text-surface-700-200">
				{@render children()}
			</div>
		</article>
		<nav class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface-500">
			<a class="no-underline hover:text-primary-500" href="/">Home</a>
			<a class="no-underline hover:text-primary-500" href="/terms">Terms of Use</a>
			<a class="no-underline hover:text-primary-500" href="/privacy">Privacy Policy</a>
			<a class="no-underline hover:text-primary-500" href="/sitemap">Sitemap</a>
		</nav>
	</div>
</AnimatedGridShell>

<style>
	.legal-prose :global(h2) {
		font-size: 1.125rem;
		font-weight: 700;
		margin: 1.75rem 0 0.75rem;
		letter-spacing: -0.02em;
	}

	.legal-prose :global(p) {
		margin: 0 0 0.875rem;
	}

	.legal-prose :global(ul) {
		margin: 0 0 0.875rem;
		padding-left: 1.25rem;
	}

	.legal-prose :global(li) {
		margin-bottom: 0.35rem;
	}

	.legal-prose :global(a) {
		color: var(--color-primary-500, #1ca048);
		text-decoration: none;
	}

	.legal-prose :global(a:hover) {
		text-decoration: underline;
	}

	.legal-prose :global(code) {
		font-family: var(--font-mono-status, ui-monospace, monospace);
		font-size: 0.9em;
	}
</style>
