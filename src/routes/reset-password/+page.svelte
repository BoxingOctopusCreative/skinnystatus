<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME } from '$lib/brand';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Reset password · {data.siteName}</title>
</svelte:head>

<div class="mx-auto w-[min(420px,calc(100%-2rem))] mt-16 pb-12">
	<div class="flex justify-end mb-3">
		<ThemeToggle />
	</div>
	<div class="card preset-filled-surface-100-900 p-5 border border-surface-200-800">
		<a class="block mb-5 leading-none" href="/" aria-label={BRAND_NAME}>
			<img src={BRAND_LOGO_WIDE} alt={BRAND_NAME} width="220" height="44" class="h-9 w-auto block" />
		</a>
		<h1 class="text-2xl font-bold mt-0 mb-4">Reset password</h1>

		{#if !data.token}
			<p class="text-error-500 text-sm">Missing reset token. Use the link from your email.</p>
			<p class="text-sm text-surface-500 mt-4">
				<a href="/forgot-password">Request a new link</a>
			</p>
		{:else}
			<form method="post" use:enhance class="flex flex-col gap-3">
				<input type="hidden" name="token" value={data.token} />
				<label class="label">
					<span class="label-text">New password</span>
					<input
						class="input"
						type="password"
						name="newPassword"
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>
				<label class="label">
					<span class="label-text">Confirm new password</span>
					<input
						class="input"
						type="password"
						name="confirm"
						required
						minlength="8"
						autocomplete="new-password"
					/>
				</label>
				<button class="btn preset-filled-primary-500" type="submit">Set new password</button>
			</form>
			{#if form?.message}
				<p class="text-error-500 text-sm mt-4">{form.message}</p>
			{/if}
		{/if}
	</div>
</div>
