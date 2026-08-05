<script lang="ts">
	import { page } from '$app/state';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import TeamSwitcher from '$lib/components/TeamSwitcher.svelte';
	import { BRAND_FAVICON, BRAND_NAME } from '$lib/brand';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const isLogin = $derived(page.url.pathname.startsWith('/dashboard/login'));
	const isPreview = $derived(page.url.pathname.startsWith('/dashboard/preview'));
	const isCreateTeam = $derived(page.url.pathname.startsWith('/dashboard/teams/new'));

	const links = [
		{ href: '/dashboard/projects', label: 'Projects' },
		{ href: '/dashboard/services', label: 'Services' },
		{ href: '/dashboard/incidents', label: 'Incidents' },
		{ href: '/dashboard/billing', label: 'Billing' }
	];
</script>

{#if isLogin || isPreview}
	{@render children()}
{:else}
	<nav class="dashboard-nav flex items-center gap-4 px-4 py-3 flex-wrap">
		<a
			class="inline-flex items-center leading-none"
			href="/dashboard"
			aria-label={BRAND_NAME}
			aria-current={page.url.pathname === '/dashboard' ? 'page' : undefined}
		>
			<img src={BRAND_FAVICON} alt="" width="40" height="40" class="block w-10 h-10 rounded-lg" />
		</a>
		{#if !isCreateTeam}
			{#each links as link (link.href)}
				<a
					href={link.href}
					class="dashboard-nav-link text-sm hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
					aria-current={
						page.url.pathname === link.href || page.url.pathname.startsWith(link.href + '/')
							? 'page'
							: undefined
					}>{link.label}</a
				>
			{/each}
			{#if data.team && data.teams.length > 0}
				<div class="dashboard-nav-team">
					<TeamSwitcher teams={data.teams} teamId={data.team.id} />
				</div>
			{/if}
		{/if}
		{#if data.user}
			<div class="ml-auto">
				<UserMenu
					email={data.user.email}
					imageUrl={data.user.imageUrl}
					teamId={data.team?.id ?? null}
				/>
			</div>
		{/if}
	</nav>
	<div class="mx-auto w-[min(960px,calc(100%-2rem))] pb-12 pt-8">
		{@render children()}
	</div>
{/if}

<style>
	.dashboard-nav {
		/* Near-black green: darker than primary-950 by mixing with black. */
		background: linear-gradient(
			105deg,
			color-mix(in oklab, var(--color-primary-950) 72%, black) 0%,
			color-mix(in oklab, var(--color-primary-950) 72%, black) 42%,
			color-mix(in oklab, var(--color-primary-950) 48%, black) 68%,
			color-mix(in oklab, var(--color-primary-950) 28%, black) 100%
		);
		border-bottom: 1px solid color-mix(in oklab, var(--color-primary-400) 38%, var(--color-surface-500));
		color: var(--color-primary-contrast-500);
	}

	.dashboard-nav-link {
		color: color-mix(in oklab, var(--color-primary-contrast-500) 92%, transparent);
		text-decoration: none;
	}

	.dashboard-nav-link:hover,
	.dashboard-nav-link[aria-current='page'] {
		color: var(--color-primary-contrast-500);
	}

	.dashboard-nav-team :global(.label-text) {
		color: color-mix(in oklab, var(--color-primary-contrast-500) 75%, transparent);
	}

	.dashboard-nav-team :global(.select) {
		background: color-mix(in oklab, black 35%, transparent);
		border-color: color-mix(in oklab, white 35%, transparent);
		color: var(--color-primary-contrast-500);
		appearance: auto;
	}

	.dashboard-nav :global(.avatar-btn) {
		border-color: color-mix(in oklab, white 55%, transparent);
		background: color-mix(in oklab, black 22%, transparent);
		color: white;
	}

	.dashboard-nav :global(.avatar-btn:hover),
	.dashboard-nav :global(.avatar-btn[aria-expanded='true']) {
		border-color: white;
		outline-color: white;
	}
</style>
