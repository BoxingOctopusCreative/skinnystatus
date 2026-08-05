<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME } from '$lib/brand';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Forgot password · {data.siteName}</title>
</svelte:head>

<div class="mx-auto w-[min(420px,calc(100%-2rem))] mt-16 pb-12">
	<div class="flex justify-end mb-3">
		<ThemeToggle />
	</div>
	<div class="card preset-filled-surface-100-900 p-5 border border-surface-200-800">
		<a class="block mb-5 leading-none" href="/" aria-label={BRAND_NAME}>
			<img src={BRAND_LOGO_WIDE} alt={BRAND_NAME} width="220" height="44" class="h-9 w-auto block" />
		</a>
		<h1 class="text-2xl font-bold mt-0 mb-4">Forgot password</h1>

		{#if form?.sent}
			<p class="text-success-500 text-sm">
				If that email is registered, you will receive a reset link shortly. Check your inbox.
			</p>
			<p class="text-sm text-surface-500 mt-4">
				<a href="/dashboard/login">Back to sign in</a>
			</p>
		{:else}
			<p class="text-sm text-surface-500 mb-4">
				Enter your account email and we'll send a password reset link.
			</p>
			<form method="post" use:enhance class="flex flex-col gap-3">
				<label class="label">
					<span class="label-text">Email</span>
					<input class="input" type="email" name="email" required autocomplete="email" />
				</label>
				<button class="btn preset-filled-primary-500" type="submit">Send reset link</button>
			</form>
			{#if form?.message}
				<p class="text-error-500 text-sm mt-4">{form.message}</p>
			{/if}
			<p class="text-sm text-surface-500 mt-5">
				<a href="/dashboard/login">Back to sign in</a>
			</p>
		{/if}
	</div>
</div>
