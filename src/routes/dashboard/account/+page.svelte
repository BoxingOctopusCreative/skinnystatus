<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import ImageCropUpload from '$lib/components/ImageCropUpload.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let deleteConfirmEmail = $state('');
	let showDeleteForm = $state(false);
	let passkeyBusy = $state(false);
	let passkeyMessage = $state('');
	let passkeyError = $state('');

	async function addPasskey() {
		passkeyBusy = true;
		passkeyMessage = '';
		passkeyError = '';
		try {
			const result = await authClient.passkey.addPasskey({ name: 'Device passkey' });
			if (result.error) {
				passkeyError = result.error.message || 'Failed to add passkey';
				return;
			}
			passkeyMessage = 'Passkey registered.';
			await invalidateAll();
		} catch (err) {
			passkeyError = err instanceof Error ? err.message : 'Failed to add passkey';
		} finally {
			passkeyBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Account</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-5">Account</h1>

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
	<h2 class="text-lg font-semibold mb-4">Profile</h2>

	<div class="flex items-start gap-5 mb-6 pb-6 border-b border-surface-200-800">
		{#if data.imageUrl}
			<img
				class="w-20 h-20 rounded-full shrink-0 border-2 border-surface-300-700 object-cover block"
				src={data.imageUrl}
				alt=""
			/>
		{:else}
			<div
				class="w-20 h-20 rounded-full shrink-0 border-2 border-surface-300-700 flex items-center justify-center bg-surface-200-800 text-2xl font-semibold text-surface-500"
				aria-hidden="true"
			>
				{data.name.slice(0, 1).toUpperCase()}
			</div>
		{/if}
		<div class="flex-1 min-w-0">
			<p class="text-sm text-surface-500 mb-2">Profile picture</p>
			<ImageCropUpload
				action="?/uploadAvatar"
				fieldName="avatar"
				aspectRatio={1}
				outputWidth={512}
				outputHeight={512}
				maxBytes={2 * 1024 * 1024}
				label="Choose an image (JPEG, PNG, GIF, or WebP - you'll crop next)"
				errorFromFailure={(d) => {
					const nested = d.uploadAvatar as { message?: string } | undefined;
					return nested?.message ?? null;
				}}
			/>
			{#if form?.uploadAvatar?.success}
				<p class="text-success-500 text-sm mt-2">Profile picture updated.</p>
			{/if}
			{#if form?.uploadAvatar?.message}
				<p class="text-error-500 text-sm mt-2">{form.uploadAvatar.message}</p>
			{/if}
		</div>
	</div>

	<form method="post" action="?/updateProfile" use:enhance class="flex flex-col gap-3">
		<label class="label">
			<span class="label-text">Name</span>
			<input class="input" type="text" name="name" value={data.name} required autocomplete="name" />
		</label>
		<label class="label">
			<span class="label-text">Username</span>
			<input
				class="input"
				type="text"
				name="username"
				value={data.username ?? ''}
				autocomplete="username"
				placeholder="e.g. janedoe"
			/>
		</label>
		<label class="label">
			<span class="label-text">Email</span>
			<input class="input" type="email" value={data.email} disabled />
		</label>
		<div>
			<button class="btn preset-filled-primary-500" type="submit">Save profile</button>
		</div>
	</form>
	{#if form?.updateProfile?.success}
		<p class="text-success-500 text-sm mt-3">Profile updated.</p>
	{/if}
	{#if form?.updateProfile?.message}
		<p class="text-error-500 text-sm mt-3">{form.updateProfile.message}</p>
	{/if}
</div>

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
	<h2 class="text-lg font-semibold mb-4">Password</h2>
	{#if data.hasPassword}
		<form method="post" action="?/changePassword" use:enhance class="flex flex-col gap-3">
			<label class="label">
				<span class="label-text">Current password</span>
				<input class="input" type="password" name="currentPassword" required autocomplete="current-password" />
			</label>
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
			<div>
				<button class="btn preset-filled-primary-500" type="submit">Change password</button>
			</div>
		</form>
		{#if form?.changePassword?.success}
			<p class="text-success-500 text-sm mt-3">Password changed.</p>
		{/if}
		{#if form?.changePassword?.message}
			<p class="text-error-500 text-sm mt-3">{form.changePassword.message}</p>
		{/if}
	{:else}
		<p class="text-sm text-surface-500 mb-4">
			Your account uses GitHub for sign-in and has no password set. You can set a password by
			requesting a reset link sent to your email.
		</p>
		<form method="post" action="?/requestPasswordSetup" use:enhance>
			<button type="submit" class="btn preset-outlined-secondary-500">Send password setup email</button>
		</form>
		{#if form?.requestPasswordSetup?.success}
			<p class="text-success-500 text-sm mt-3">Check your inbox for a password setup link.</p>
		{/if}
		{#if form?.requestPasswordSetup?.message}
			<p class="text-error-500 text-sm mt-3">{form.requestPasswordSetup.message}</p>
		{/if}
	{/if}
</div>

{#if data.hasGithub || data.githubOAuthEnabled || data.hasGoogle || data.googleOAuthEnabled}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mb-4">Connected accounts</h2>

		{#if data.hasGithub || data.githubOAuthEnabled}
			<div class="mb-4 last:mb-0">
				{#if data.hasGithub}
					<p class="text-sm text-surface-500">GitHub is connected to this account.</p>
				{:else}
					<p class="text-sm text-surface-500 mb-4">Connect GitHub to sign in with it later.</p>
					<form method="post" action="?/linkGithub" use:enhance>
						<button
							type="submit"
							class="btn inline-flex items-center gap-2 bg-[#24292f] text-white"
						>
							<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" class="shrink-0">
								<path
									fill="currentColor"
									d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
								/>
							</svg>
							Connect GitHub
						</button>
					</form>
					{#if form?.linkGithub?.message}
						<p class="text-error-500 text-sm mt-3">{form.linkGithub.message}</p>
					{/if}
					{#if data.githubLinkError}
						<p class="text-error-500 text-sm mt-3">Could not connect GitHub. Try again.</p>
					{/if}
				{/if}
			</div>
		{/if}

		{#if data.hasGoogle || data.googleOAuthEnabled}
			<div class="mb-0">
				{#if data.hasGoogle}
					<p class="text-sm text-surface-500">Google is connected to this account.</p>
				{:else}
					<p class="text-sm text-surface-500 mb-4">Connect Google to sign in with it later.</p>
					<form method="post" action="?/linkGoogle" use:enhance>
						<button
							type="submit"
							class="btn inline-flex items-center gap-2 preset-outlined-secondary-500"
						>
							<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" class="shrink-0">
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
							Connect Google
						</button>
					</form>
					{#if form?.linkGoogle?.message}
						<p class="text-error-500 text-sm mt-3">{form.linkGoogle.message}</p>
					{/if}
					{#if data.googleLinkError}
						<p class="text-error-500 text-sm mt-3">Could not connect Google. Try again.</p>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
	<h2 class="text-lg font-semibold mb-4">Two-factor authentication</h2>
	{#if data.twoFactorEnabled && !form?.enableTwoFactor?.success}
		<p class="text-sm text-surface-500 mb-4">2FA is currently enabled on your account.</p>
		{#if data.hasPassword}
			<form method="post" action="?/disableTwoFactor" use:enhance class="flex flex-col gap-3">
				<label class="label">
					<span class="label-text">Password to confirm</span>
					<input class="input" type="password" name="password" required autocomplete="current-password" />
				</label>
				<div>
					<button type="submit" class="btn preset-outlined-secondary-500">Disable 2FA</button>
				</div>
			</form>
			{#if form?.disableTwoFactor?.success}
				<p class="text-success-500 text-sm mt-3">Two-factor authentication disabled.</p>
			{/if}
			{#if form?.disableTwoFactor?.message}
				<p class="text-error-500 text-sm mt-3">{form.disableTwoFactor.message}</p>
			{/if}
		{:else}
			<p class="text-sm text-surface-500">Set a password to manage 2FA.</p>
		{/if}
	{:else if form?.enableTwoFactor?.success && form.enableTwoFactor.totpURI}
		<p class="text-success-500 text-sm">Two-factor authentication enabled.</p>
		<p class="text-sm text-surface-500 mt-3 mb-1.5">
			Scan this URI with your authenticator app (Google Authenticator, Authy, etc.):
		</p>
		<code class="block break-all font-mono text-xs bg-surface-200-800 border border-surface-300-700 rounded p-2 mt-2">{form.enableTwoFactor.totpURI}</code>
		{#if form.enableTwoFactor.backupCodes?.length}
			<p class="text-sm text-surface-500 mt-4 mb-1.5">
				Save these backup codes in a safe place. Each can be used once:
			</p>
			<pre class="font-mono text-xs bg-surface-200-800 border border-surface-300-700 rounded p-2 m-0 leading-loose">{form.enableTwoFactor.backupCodes.join('\n')}</pre>
		{/if}
	{:else}
		<p class="text-sm text-surface-500 mb-4">
			Add an extra layer of security. You will need an authenticator app.
		</p>
		{#if data.hasPassword}
			<form method="post" action="?/enableTwoFactor" use:enhance class="flex flex-col gap-3">
				<label class="label">
					<span class="label-text">Password to confirm</span>
					<input class="input" type="password" name="password" required autocomplete="current-password" />
				</label>
				<div>
					<button class="btn preset-filled-primary-500" type="submit">Enable 2FA</button>
				</div>
			</form>
			{#if form?.enableTwoFactor?.message}
				<p class="text-error-500 text-sm mt-3">{form.enableTwoFactor.message}</p>
			{/if}
		{:else}
			<p class="text-sm text-surface-500">Set a password first to enable 2FA.</p>
		{/if}
	{/if}
</div>

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
	<h2 class="text-lg font-semibold mb-4">Passkeys</h2>
	{#if data.passkeys.length === 0}
		<p class="text-sm text-surface-500 mb-3">No passkeys registered yet.</p>
	{:else}
		<ul class="list-none m-0 mb-3 p-0 flex flex-col">
			{#each data.passkeys as pk (pk.id)}
				<li class="flex items-center justify-between gap-3 py-2 [border-b border-surface-200-800 text-sm last:border-b-0:not(:last-child)]:border-b [border-b border-surface-200-800 text-sm last:border-b-0:not(:last-child)]:border-surface-200-800 text-sm">
					<span>{pk.name ?? 'Unnamed passkey'}</span>
					<form method="post" action="?/deletePasskey" use:enhance>
						<input type="hidden" name="id" value={pk.id} />
						<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Remove</button>
					</form>
				</li>
			{/each}
		</ul>
	{/if}
	<button type="button" class="btn preset-outlined-secondary-500" disabled={passkeyBusy} onclick={addPasskey}>
		{passkeyBusy ? 'Waiting for device...' : 'Add passkey'}
	</button>
	{#if passkeyMessage}
		<p class="text-success-500 text-sm mt-3">{passkeyMessage}</p>
	{/if}
	{#if passkeyError}
		<p class="text-error-500 text-sm mt-3">{passkeyError}</p>
	{/if}
	{#if form?.deletePasskey?.success}
		<p class="text-success-500 text-sm mt-3">Passkey removed.</p>
	{/if}
	{#if form?.deletePasskey?.message}
		<p class="text-error-500 text-sm mt-3">{form.deletePasskey.message}</p>
	{/if}
</div>

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-error-500">
	<h2 class="text-lg font-semibold mb-4 text-error-500">Delete account</h2>
	<p class="text-sm text-surface-500 mb-4">
		Your account will be scheduled for deletion. You have 30 days to reactivate it using the link we
		send to your email.
	</p>
	{#if !showDeleteForm}
		<button
			type="button"
			class="btn preset-outlined-secondary-500"
			onclick={() => {
				showDeleteForm = true;
			}}>Delete my account</button
		>
	{:else}
		<form method="post" action="?/deleteAccount" use:enhance class="flex flex-col gap-3">
			<label class="label">
				<span class="label-text">Type your email to confirm: <strong>{data.email}</strong></span>
				<input
					class="input"
					type="email"
					name="confirmEmail"
					required
					bind:value={deleteConfirmEmail}
					placeholder={data.email}
					autocomplete="off"
				/>
			</label>
			<div class="flex flex-wrap gap-2">
				<button
					type="submit"
					class="btn preset-filled-error-500"
					disabled={deleteConfirmEmail !== data.email}
				>Delete account</button>
				<button
					type="button"
					class="btn preset-outlined-secondary-500"
					onclick={() => {
						showDeleteForm = false;
						deleteConfirmEmail = '';
					}}>Cancel</button
				>
			</div>
		</form>
		{#if form?.deleteAccount?.message}
			<p class="text-error-500 text-sm mt-4">{form.deleteAccount.message}</p>
		{/if}
	{/if}
</div>
