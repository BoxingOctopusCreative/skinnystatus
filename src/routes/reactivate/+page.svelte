<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME } from '$lib/brand';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Reactivate account · {data.siteName}</title>
</svelte:head>

<div class="mx-auto w-[min(420px,calc(100%-2rem))] mt-16 pb-12">
	<div class="flex justify-end mb-3">
		<ThemeToggle />
	</div>
	<div class="card preset-filled-surface-100-900 p-5 border border-surface-200-800">
		<a class="block mb-5 leading-none" href="/" aria-label={BRAND_NAME}>
			<img src={BRAND_LOGO_WIDE} alt={BRAND_NAME} width="220" height="44" class="h-9 w-auto block" />
		</a>
		<h1 class="text-2xl font-bold mt-0 mb-4">Reactivate account</h1>

		{#if data.mode === 'loggedIn'}
			<p class="text-sm text-surface-500 mb-4">
				Your account is scheduled for deletion. Reactivate to keep your data and status pages.
			</p>
			<form method="post" action="?/reactivate" use:enhance>
				<button class="btn preset-filled-primary-500" type="submit">Reactivate my account</button>
			</form>
			{#if form?.message}
				<p class="text-error-500 text-sm mt-4">{form.message}</p>
			{/if}
			<p class="text-sm text-surface-500 mt-4">
				<a href="/dashboard/logout">Sign out instead</a>
			</p>
		{:else if data.mode === 'invalid'}
			<p class="text-error-500 text-sm">
				This reactivation link is invalid or has expired. If your account is still within the grace
				period, sign in and reactivate from this page.
			</p>
			<p class="text-sm text-surface-500 mt-4">
				<a href="/dashboard/login">Sign in</a>
			</p>
		{:else}
			<p class="text-sm text-surface-500">
				To reactivate your account, use the link from the email we sent you, or sign in and visit
				this page.
			</p>
			<p class="text-sm text-surface-500 mt-3">
				<a href="/dashboard/login">Sign in</a>
			</p>
		{/if}
	</div>
</div>
