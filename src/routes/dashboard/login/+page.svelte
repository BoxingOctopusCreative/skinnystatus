<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import AnimatedGridShell from '$lib/components/AnimatedGridShell.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME } from '$lib/brand';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const redirectTo = $derived(page.url.searchParams.get('redirectTo') || '/dashboard');
</script>

<svelte:head>
	<title>Sign in · {data.siteName}</title>
	{#if data.turnstileSiteKey}
		<script
			src="https://challenges.cloudflare.com/turnstile/v0/api.js"
			async
			defer
		></script>
	{/if}
</svelte:head>

<AnimatedGridShell>
	<div
		class="relative z-10 mx-auto flex min-h-screen w-[min(420px,calc(100%-2rem))] flex-col items-center justify-center gap-8 py-12"
	>
		<a class="block w-full leading-none" href="/" aria-label={BRAND_NAME}>
			<img
				src={BRAND_LOGO_WIDE}
				alt={BRAND_NAME}
				width="360"
				height="72"
				class="w-full h-auto block"
			/>
		</a>
		<div class="card w-full preset-filled-surface-100-900 p-5 border border-surface-200-800">
			<h1 class="text-2xl font-bold mt-0 mb-5">Sign in</h1>

			{#if data.reset}
				<p class="text-success-500 text-sm mb-4">Password reset. Sign in with your new password.</p>
			{/if}
			{#if data.reactivated}
				<p class="text-success-500 text-sm mb-4">Account reactivated. Sign in to continue.</p>
			{/if}
			{#if data.deleted}
				<p class="text-success-500 text-sm mb-4">
					Account scheduled for deletion. Check your email for a reactivation link.
				</p>
			{/if}

			{#if data.githubOAuthEnabled || data.googleOAuthEnabled}
				<div class="flex flex-col gap-2">
					{#if data.githubOAuthEnabled}
						<form method="post" action="?/signInSocial" use:enhance>
							<input type="hidden" name="callbackURL" value={redirectTo} />
							<input type="hidden" name="provider" value="github" />
							<button
								class="btn w-full bg-[#24292f] text-white inline-flex items-center justify-center gap-2"
								type="submit"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="18"
									height="18"
									aria-hidden="true"
									fill="currentColor"
								>
									<path
										d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.295 2.747-1.026 2.747-1.026.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
									/>
								</svg>
								Continue with GitHub
							</button>
						</form>
					{/if}
					{#if data.googleOAuthEnabled}
						<form method="post" action="?/signInSocial" use:enhance>
							<input type="hidden" name="callbackURL" value={redirectTo} />
							<input type="hidden" name="provider" value="google" />
							<button
								class="btn w-full preset-outlined-secondary-500 inline-flex items-center justify-center gap-2"
								type="submit"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="18"
									height="18"
									aria-hidden="true"
								>
									<path
										fill="#4285F4"
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
									/>
									<path
										fill="#34A853"
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									/>
									<path
										fill="#FBBC05"
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									/>
									<path
										fill="#EA4335"
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									/>
								</svg>
								Continue with Google
							</button>
						</form>
					{/if}
				</div>
				<p class="my-4 text-center text-sm text-surface-500" role="separator">or</p>
			{/if}

			<form method="post" action="?/signInEmail" use:enhance class="flex flex-col gap-3">
				<input type="hidden" name="redirectTo" value={redirectTo} />
				<label class="label">
					<span class="label-text">Email or username</span>
					<input class="input" type="text" name="email" required autocomplete="username" />
				</label>
				<label class="label">
					<span class="label-text">Password</span>
					<input
						class="input"
						type="password"
						name="password"
						required
						autocomplete="current-password"
					/>
				</label>
				{#if data.turnstileSiteKey}
					<div
						class="cf-turnstile"
						data-sitekey={data.turnstileSiteKey}
						data-action="turnstile-spin-v2"
					></div>
				{/if}
				<button class="btn preset-filled-primary-500" type="submit">Sign in</button>
			</form>

			{#if data.githubError}
				<p class="text-error-500 text-sm mt-4">GitHub sign-in failed. Try again or use email.</p>
			{/if}
			{#if data.googleError}
				<p class="text-error-500 text-sm mt-4">Google sign-in failed. Try again or use email.</p>
			{/if}
			{#if form?.message}
				<p class="text-error-500 text-sm mt-4">{form.message}</p>
			{/if}

			<p class="text-sm text-surface-500 mt-5">
				<a href="/forgot-password">Forgot password?</a>
			</p>
			<p class="text-sm text-surface-500 mt-2">
				New here? <a href="/signup?redirectTo={encodeURIComponent(redirectTo)}">Create an account</a>
			</p>
		</div>
	</div>
</AnimatedGridShell>
