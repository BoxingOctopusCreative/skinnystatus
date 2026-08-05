<script lang="ts">
	import { page } from '$app/state';
	import { Sun, Moon, User, LogOut, Settings, CreditCard } from 'lucide-svelte';
	import { themeState, toggleTheme } from '$lib/theme.svelte';

	let {
		email,
		imageUrl = null,
		teamId = null
	}: {
		email: string;
		imageUrl?: string | null;
		teamId?: string | null;
	} = $props();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	const isDark = $derived(themeState.value === 'dark');
	const onAccount = $derived(page.url.pathname.startsWith('/dashboard/account'));
	const onTeamSettings = $derived(page.url.pathname.startsWith('/dashboard/settings'));
	const onBilling = $derived(page.url.pathname.startsWith('/dashboard/billing'));
	const themeLabel = $derived(isDark ? 'Switch to light mode' : 'Switch to dark mode');
	const teamSettingsHref = $derived(
		teamId ? `/dashboard/settings?team=${teamId}` : '/dashboard/settings'
	);

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function onDocumentClick(event: MouseEvent) {
		if (!open || !rootEl) return;
		const target = event.target;
		if (target instanceof Node && !rootEl.contains(target)) close();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}
</script>

<svelte:document onclick={onDocumentClick} onkeydown={onKeydown} />

<div class="user-menu" bind:this={rootEl}>
	<button
		type="button"
		class="avatar-btn"
		aria-label="Account menu"
		aria-haspopup="menu"
		aria-expanded={open}
		title={email}
		onclick={toggle}
	>
		{#if imageUrl}
			<img src={imageUrl} alt="" class="w-full h-full object-cover block" />
		{:else}
			<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
				<path
					fill="currentColor"
					d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2h19.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z"
				/>
			</svg>
		{/if}
	</button>

	{#if open}
		<div class="menu" role="menu" aria-label="Account">
			<a
				href="/dashboard/account"
				role="menuitem"
				class="menu-item"
				aria-current={onAccount ? 'page' : undefined}
				onclick={close}
			>
				<User size={16} strokeWidth={2} aria-hidden="true" />
				Account
			</a>
			<a
				href={teamSettingsHref}
				role="menuitem"
				class="menu-item"
				aria-current={onTeamSettings ? 'page' : undefined}
				onclick={close}
			>
				<Settings size={16} strokeWidth={2} aria-hidden="true" />
				Team Settings
			</a>
			<a
				href="/dashboard/billing"
				role="menuitem"
				class="menu-item"
				aria-current={onBilling ? 'page' : undefined}
				onclick={close}
			>
				<CreditCard size={16} strokeWidth={2} aria-hidden="true" />
				Billing
			</a>
			<button type="button" role="menuitem" class="menu-item" onclick={toggleTheme}>
				{#if isDark}
					<Sun size={16} strokeWidth={2} aria-hidden="true" />
				{:else}
					<Moon size={16} strokeWidth={2} aria-hidden="true" />
				{/if}
				{themeLabel}
			</button>
			<form method="post" action="/dashboard/logout" class="m-0">
				<button type="submit" role="menuitem" class="menu-item menu-item-danger">
					<LogOut size={16} strokeWidth={2} aria-hidden="true" />
					Sign out
				</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.user-menu {
		position: relative;
	}

	.avatar-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border-radius: 9999px;
		overflow: hidden;
		border: 1px solid var(--color-surface-300-700, var(--color-surface-300));
		background: var(--color-surface-100-900, var(--color-surface-100));
		color: var(--color-surface-500);
		cursor: pointer;
		flex-shrink: 0;
	}

	.avatar-btn:hover {
		border-color: var(--color-primary-500);
	}

	.avatar-btn[aria-expanded='true'] {
		outline: 2px solid var(--color-primary-500);
		outline-offset: 2px;
	}

	.menu {
		position: absolute;
		top: calc(100% + 0.5rem);
		right: 0;
		z-index: 40;
		min-width: 13.5rem;
		padding: 0.35rem;
		border-radius: 0.5rem;
		border: 1px solid var(--color-surface-300-700, var(--color-surface-300));
		background: var(--color-surface-100-900, var(--color-surface-100));
		color: var(--color-surface-950-50, var(--color-surface-950));
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		width: 100%;
		margin: 0;
		padding: 0.55rem 0.7rem;
		border: none;
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.875rem;
		text-align: left;
		text-decoration: none;
		cursor: pointer;
	}

	.menu-item:hover {
		background: color-mix(in oklab, var(--color-surface-200-800, var(--color-surface-200)) 80%, transparent);
	}

	.menu-item[aria-current='page'] {
		font-weight: 600;
	}

	.menu-item-danger {
		color: var(--color-error-500);
	}
</style>
