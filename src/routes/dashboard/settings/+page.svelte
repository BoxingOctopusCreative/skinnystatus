<script lang="ts">
	import { enhance } from '$app/forms';
	import { Eye, EyeOff, Save, Trash2 } from 'lucide-svelte';
	import ImageCropUpload from '$lib/components/ImageCropUpload.svelte';
	import type { HostProvider } from '$lib/publishing';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const providerLabels: Record<string, string> = {
		vercel: 'Vercel',
		cloudflare_pages: 'Cloudflare Pages',
		netlify: 'Netlify',
		github_pages: 'GitHub Pages',
		static_app: 'static.app',
		amazon_s3: 'Amazon S3',
		firebase_hosting: 'Firebase Hosting',
		azure_static_web_apps: 'Azure Static Web Apps'
	};

	let revealToken = $state<Partial<Record<HostProvider, boolean>>>({});
	let copied = $state(false);

	type SubmittedValues = Record<string, string>;

	function toggleToken(provider: HostProvider) {
		revealToken = { ...revealToken, [provider]: !revealToken[provider] };
	}

	function tokenType(provider: HostProvider) {
		return revealToken[provider] ? 'text' : 'password';
	}

	function submittedValuesFor(provider: HostProvider): SubmittedValues | null {
		if (!form || !('tested' in form) || form.tested !== provider) return null;
		if (!('submitted' in form) || !form.submitted) return null;
		return form.submitted as SubmittedValues;
	}

	function fieldValue(provider: HostProvider, name: string, savedValue = '') {
		return submittedValuesFor(provider)?.[name] ?? savedValue;
	}

	async function copyLink() {
		if (!data.inviteLink) return;
		try {
			await navigator.clipboard.writeText(data.inviteLink);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

{#snippet secretField(
	provider: HostProvider,
	name: string,
	label: string,
	value: string
)}
	<label class="label">
		<span class="label-text">{label}</span>
		<div class="secret-field">
			<input
				class="input secret-input"
				{name}
				type={tokenType(provider)}
				autocomplete="off"
				required
				{value}
				readonly={!data.canManage}
			/>
			{#if value}
				<button
					class="secret-toggle"
					type="button"
					aria-label={revealToken[provider] ? 'Hide token' : 'Show token'}
					onclick={() => toggleToken(provider)}
				>
					{#if revealToken[provider]}
						<EyeOff size={16} strokeWidth={2} aria-hidden="true" />
					{:else}
						<Eye size={16} strokeWidth={2} aria-hidden="true" />
					{/if}
				</button>
			{/if}
		</div>
	</label>
{/snippet}

<svelte:head>
	<title>Settings · {data.team.name}</title>
</svelte:head>

{#if data.bannerUrl}
	<div
		class="w-full rounded-lg bg-cover bg-center border border-surface-200-800 my-3"
		style="background-image: url('{data.bannerUrl}'); height: clamp(8rem, 22vw, 14rem)"
		aria-hidden="true"
	></div>
{/if}

<h1 class="text-2xl font-bold mb-2">Settings · {data.team.name}</h1>
<p class="text-sm text-surface-500 mb-5">
	Your role: {data.role}. Host credentials and team settings for this team.
</p>

{#if form?.message && !('tested' in form && form.tested)}
	<p class="text-error-500 text-sm mb-3">{form.message}</p>
{/if}
{#if form && 'success' in form && form.success && !('tested' in form && form.tested) && !('provider' in form) && !('cleared' in form)}
	<p class="text-success-500 text-sm mb-3">Updated.</p>
{/if}
{#if form && 'success' in form && form.success && (('provider' in form && form.provider) || ('cleared' in form && form.cleared))}
	<p class="text-success-500 text-sm mb-3">Credentials updated.</p>
{/if}

{#if data.canManage}
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-3">Publishing</h2>
		<p class="text-sm text-surface-500 mb-3">
			Used for deploy path nesting and public URL hints. DNS for custom domains still points at
			your static host (Vercel, Cloudflare, and so on), not this admin app.
		</p>
		<form method="post" action="?/savePublishing" use:enhance class="flex flex-col gap-3 max-w-xl">
			<label class="label">
				<span class="label-text">Base domain</span>
				<input
					class="input"
					name="publishBaseDomain"
					placeholder="status.example.com"
					autocomplete="off"
					value={data.publishBaseDomain}
				/>
				<span class="text-xs text-surface-500 mt-1">
					For subdomain mode: CNAME <code>{'<slug>'}.{data.publishBaseDomain || 'your.domain'}</code> →
					your host. Leave blank until you have a domain.
				</span>
			</label>
			<label class="label">
				<span class="label-text">Path prefix</span>
				<input
					class="input"
					name="publishPathPrefix"
					required
					autocomplete="off"
					value={data.publishPathPrefix}
				/>
				<span class="text-xs text-surface-500 mt-1">
					Path-mode deploys nest under <code>/{data.publishPathPrefix || 's'}/{'<slug>'}</code> on your
					host.
				</span>
			</label>
			<button type="submit" class="btn preset-filled-primary-500 w-fit">Save publishing</button>
		</form>
	</div>
{:else}
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-3">Publishing</h2>
		<p class="text-sm text-surface-500 mb-1">
			Base domain: <code>{data.publishBaseDomain || '(not set)'}</code>
		</p>
		<p class="text-sm text-surface-500">
			Path prefix: <code>/{data.publishPathPrefix}</code>
		</p>
	</div>
{/if}

{#if data.canManage}
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-3">Hero banner</h2>
		<p class="text-sm text-surface-500 mb-3">
			Wide image shown at the top of the team landing page on the dashboard. You'll crop it after
			choosing a file.
		</p>
		{#if data.bannerUrl}
			<img
				class="block w-full max-h-40 object-cover rounded-lg border border-surface-200-800 mb-3"
				src={data.bannerUrl}
				alt=""
			/>
		{/if}
		<ImageCropUpload
			action="?/uploadBanner"
			fieldName="banner"
			aspectRatio={3}
			outputWidth={1800}
			outputHeight={600}
			maxBytes={5 * 1024 * 1024}
			label="Choose banner image (JPEG, PNG, GIF, or WebP)"
		/>
		{#if data.bannerUrl}
			<form method="post" action="?/removeBanner" use:enhance class="mt-3">
				<button type="submit" class="btn preset-outlined-secondary-500">Remove banner</button>
			</form>
		{/if}
	</div>
{/if}

{#if data.inviteLink}
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-3">Invite link</h2>
		{#if data.inviteEmailSent}
			<p class="text-sm text-surface-500 mb-3">Invite email sent. You can also share this link:</p>
		{:else}
			<p class="text-sm text-surface-500 mb-3">Share this link with anyone you want to invite:</p>
		{/if}
		<code class="block break-all font-mono text-xs bg-surface-200-800 border border-surface-300-700 rounded p-2">{data.inviteLink}</code>
		<button type="button" class="btn preset-outlined-secondary-500 mt-3" onclick={copyLink}>
			{copied ? 'Copied' : 'Copy link'}
		</button>
	</div>
{/if}

{#if data.canManage}
	<div class="mb-8">
		<h2 class="text-lg font-semibold mb-3">Invite people</h2>
		<form method="post" action="?/invite" use:enhance class="flex flex-col gap-3">
			<label class="label">
				<span class="label-text">Email (optional - leave blank for a link-only invite)</span>
				<input class="input" type="email" name="email" placeholder="colleague@example.com" />
			</label>
			<label class="label">
				<span class="label-text">Role</span>
				<select class="select" name="role">
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<div>
				<button class="btn preset-filled-primary-500" type="submit">Create invite</button>
			</div>
		</form>
	</div>

	{#if data.invites.length > 0}
		<div class="mb-8">
			<h2 class="text-lg font-semibold mb-3">Pending invites</h2>
			<ul class="list-none m-0 p-0">
				{#each data.invites as inv (inv.id)}
					<li class="flex items-center justify-between gap-3 flex-wrap py-2 not-last:border-b not-last:border-surface-200-800 text-sm">
						<span>
							{inv.email ?? 'Link-only invite'} · {inv.role} · expires {inv.expiresAt.toLocaleDateString()}
						</span>
						<form method="post" action="?/revokeInvite" use:enhance>
							<input type="hidden" name="inviteId" value={inv.id} />
							<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Revoke</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/if}

<div class="mb-8">
	<h2 class="text-lg font-semibold mb-3">Members</h2>
	<ul class="list-none m-0 p-0">
		{#each data.members as m (m.id)}
			<li class="flex items-center justify-between gap-3 flex-wrap py-2 not-last:border-b not-last:border-surface-200-800 text-sm">
				<span>
					<strong>{m.name}</strong>
					<span class="text-surface-500"> {m.email} · {m.role}</span>
				</span>
				<div class="flex flex-wrap gap-2">
					{#if data.isOwner && m.role !== 'owner'}
						<form method="post" action="?/setRole" use:enhance class="inline">
							<input type="hidden" name="userId" value={m.userId} />
							{#if m.role === 'admin'}
								<input type="hidden" name="role" value="member" />
								<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Make member</button>
							{:else}
								<input type="hidden" name="role" value="admin" />
								<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Make admin</button>
							{/if}
						</form>
						<form method="post" action="?/removeMember" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Remove</button>
						</form>
					{:else if data.canManage && m.role === 'member'}
						<form method="post" action="?/removeMember" use:enhance>
							<input type="hidden" name="userId" value={m.userId} />
							<button type="submit" class="btn preset-outlined-secondary-500 text-xs px-2 py-1">Remove</button>
						</form>
					{/if}
				</div>
			</li>
		{/each}
	</ul>
</div>

<div class="mb-8">
	<h2 class="text-lg font-semibold mb-3">Leave or delete</h2>
	{#if data.role !== 'owner'}
		<form method="post" action="?/leave" use:enhance>
			<button type="submit" class="btn preset-outlined-secondary-500">Leave team</button>
		</form>
	{:else}
		<form
			method="post"
			action="?/deleteTeam"
			use:enhance={() => {
				return async ({ update }) => {
					const ok = confirm('Delete this team? Shares and invites will be removed.');
					if (!ok) return;
					await update();
				};
			}}
		>
			<button type="submit" class="btn preset-filled-error-500">Delete team</button>
		</form>
	{/if}
</div>

<h2 class="text-xl font-semibold mb-2 mt-8">Host credentials</h2>
<p class="text-sm text-surface-500 mb-5">
	{#if data.canManage}
		Store deploy credentials for this team. Secrets are encrypted at rest.
	{:else}
		Deploy credentials for this team (read-only). Ask a team admin to update them.
	{/if}
</p>

{#each data.providers as provider (provider)}
	{@const creds = data.credentials[provider]}
	<details class="provider-pull border-b border-surface-200-800 py-3">
		<summary class="provider-summary flex items-center justify-between gap-3 flex-wrap cursor-pointer list-none">
			<span class="text-lg font-semibold min-w-0 mr-auto"
				>{providerLabels[provider] ?? provider}</span
			>
			<span
				class="font-mono text-xs border px-2 py-0.5 rounded"
				class:text-success-500={data.providerReady[provider]}
				class:border-success-500={data.providerReady[provider]}
				class:text-surface-500={!data.providerReady[provider]}
				class:border-surface-300-700={!data.providerReady[provider]}
			>
				{data.providerReady[provider] ? 'Configured' : 'Not configured'}
			</span>
		</summary>

		<form
			method="post"
			action="?/save"
			use:enhance={() => {
				return async ({ update }) => {
					// Keep typed credentials after Test/Save; default enhance reset clears
					// inputs when the value prop is unchanged and Svelte skips the DOM update.
					await update({ reset: false });
				};
			}}
			class="flex flex-col gap-3 mt-4 pl-1"
		>
			<input type="hidden" name="provider" value={provider} />

			{#if provider === 'vercel'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'token',
						'Token',
						fieldValue(provider, 'token', creds && 'token' in creds ? creds.token : '')
					)}
					<label class="label">
						<span class="label-text">Team ID <span class="text-surface-500">(optional)</span></span>
						<input
							class="input"
							name="teamId"
							autocomplete="off"
							readonly={!data.canManage}
							value={fieldValue(provider, 'teamId', creds && 'teamId' in creds ? (creds.teamId ?? '') : '')}
						/>
					</label>
				</div>
			{:else if provider === 'cloudflare_pages'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'apiToken',
						'API token',
						fieldValue(provider, 'apiToken', creds && 'apiToken' in creds ? creds.apiToken : '')
					)}
					<label class="label">
						<span class="label-text">Account ID</span>
						<input
							class="input"
							name="accountId"
							autocomplete="off"
							required
							readonly={!data.canManage}
							value={fieldValue(provider, 'accountId', creds && 'accountId' in creds ? creds.accountId : '')}
						/>
					</label>
				</div>
			{:else if provider === 'netlify'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'token',
						'Token',
						fieldValue(provider, 'token', creds && 'token' in creds ? creds.token : '')
					)}
				</div>
			{:else if provider === 'github_pages'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'token',
						'Token',
						fieldValue(provider, 'token', creds && 'token' in creds ? creds.token : '')
					)}
					<label class="label">
						<span class="label-text">Owner (user or org)</span>
						<input
							class="input"
							name="owner"
							autocomplete="off"
							required
							readonly={!data.canManage}
							value={fieldValue(provider, 'owner', creds && 'owner' in creds ? creds.owner : '')}
						/>
					</label>
				</div>
			{:else if provider === 'static_app'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'apiKey',
						'API key',
						fieldValue(provider, 'apiKey', creds && 'apiKey' in creds ? creds.apiKey : '')
					)}
				</div>
			{:else if provider === 'amazon_s3'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'accessKeyId',
						'Access key ID',
						fieldValue(provider, 'accessKeyId', creds && 'accessKeyId' in creds ? creds.accessKeyId : '')
					)}
					{@render secretField(
						provider,
						'secretAccessKey',
						'Secret access key',
						fieldValue(
							provider,
							'secretAccessKey',
							creds && 'secretAccessKey' in creds ? creds.secretAccessKey : ''
						)
					)}
					<label class="label">
						<span class="label-text">Bucket</span>
						<input
							class="input"
							name="bucket"
							autocomplete="off"
							required
							readonly={!data.canManage}
							value={fieldValue(provider, 'bucket', creds && 'bucket' in creds ? creds.bucket : '')}
						/>
					</label>
					<label class="label">
						<span class="label-text">Region</span>
						<input
							class="input"
							name="region"
							autocomplete="off"
							required
							placeholder="us-east-1"
							readonly={!data.canManage}
							value={fieldValue(provider, 'region', creds && 'region' in creds ? creds.region : '')}
						/>
					</label>
					<label class="label">
						<span class="label-text">Public base URL</span>
						<input
							class="input"
							name="publicBaseUrl"
							autocomplete="off"
							required
							placeholder="https://d111111abcdef8.cloudfront.net"
							readonly={!data.canManage}
							value={fieldValue(
								provider,
								'publicBaseUrl',
								creds && 'publicBaseUrl' in creds ? creds.publicBaseUrl : ''
							)}
						/>
					</label>
				</div>
			{:else if provider === 'firebase_hosting'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					<label class="label">
						<span class="label-text">Site ID</span>
						<input
							class="input"
							name="siteId"
							autocomplete="off"
							required
							readonly={!data.canManage}
							value={fieldValue(provider, 'siteId', creds && 'siteId' in creds ? creds.siteId : '')}
						/>
					</label>
					<label class="label col-span-full">
						<span class="label-text">Service account JSON</span>
						<textarea
							class="textarea"
							name="serviceAccountJson"
							rows="6"
							autocomplete="off"
							required
							readonly={!data.canManage}
							placeholder={'{ "client_email": "...", "private_key": "..." }'}
						>{fieldValue(
							provider,
							'serviceAccountJson',
							creds && 'serviceAccountJson' in creds ? creds.serviceAccountJson : ''
						)}</textarea>
					</label>
				</div>
			{:else if provider === 'azure_static_web_apps'}
				<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
					{@render secretField(
						provider,
						'deploymentToken',
						'Deployment token',
						fieldValue(
							provider,
							'deploymentToken',
							creds && 'deploymentToken' in creds ? creds.deploymentToken : ''
						)
					)}
					<label class="label">
						<span class="label-text">Public base URL</span>
						<input
							class="input"
							name="publicBaseUrl"
							autocomplete="off"
							required
							placeholder="https://your-app.azurestaticapps.net"
							readonly={!data.canManage}
							value={fieldValue(
								provider,
								'publicBaseUrl',
								creds && 'publicBaseUrl' in creds ? creds.publicBaseUrl : ''
							)}
						/>
					</label>
				</div>
			{/if}

			<div class="flex flex-wrap items-center gap-2 mt-1">
				{#if data.canManage}
					<button
						class="btn-icon preset-filled-primary-500"
						type="submit"
						aria-label="Save credentials"
					>
						<Save size={18} strokeWidth={2} aria-hidden="true" />
					</button>
					{#if data.providerReady[provider]}
						<button
							class="btn-icon preset-filled-error-500"
							type="submit"
							formaction="?/clear"
							formnovalidate
							aria-label="Clear credentials"
						>
							<Trash2 size={18} strokeWidth={2} aria-hidden="true" />
						</button>
					{/if}
					<button class="btn preset-outlined-primary-500" type="submit" formaction="?/test">
						Test
					</button>
				{/if}
				<span class="inline-flex items-center gap-2 ml-auto flex-wrap">
					{#if form && 'tested' in form && form.tested === provider}
						{@const testOk = 'testMessage' in form ? form.testMessage : null}
						{@const testErr =
							!testOk && form && typeof form === 'object' && 'message' in form
								? String((form as { message?: string }).message ?? '')
								: ''}
						{#if testOk}
							<span class="text-success-500 text-sm">{testOk}</span>
						{:else if testErr}
							<span class="text-error-500 text-sm">{testErr}</span>
						{/if}
					{/if}
					<a
						class="text-sm"
						href="/dashboard/settings/setup/{provider}"
						target="_blank"
						rel="noopener"
					>Setup instructions</a>
				</span>
			</div>
		</form>
	</details>
{/each}

<style>
	.provider-summary::-webkit-details-marker {
		display: none;
	}

	.provider-summary::after {
		content: '';
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		margin-left: 0.35rem;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(45deg);
		opacity: 0.65;
		flex-shrink: 0;
		align-self: center;
	}

	details[open] > .provider-summary::after {
		transform: rotate(-135deg);
		margin-top: 0.2rem;
	}

	.secret-field {
		position: relative;
	}

	.secret-input {
		padding-right: 2.5rem;
	}

	.secret-toggle {
		position: absolute;
		top: 50%;
		right: 0.4rem;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border: none;
		border-radius: 0.25rem;
		background: transparent;
		color: var(--color-surface-500);
		cursor: pointer;
	}

	.secret-toggle:hover {
		color: var(--color-surface-950-50, var(--color-surface-950));
	}

	.secret-toggle:focus-visible {
		outline: 2px solid var(--color-primary-500);
		outline-offset: 1px;
	}
</style>
