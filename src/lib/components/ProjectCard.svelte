<script lang="ts">
	import { enhance } from '$app/forms';
	import { Eye, Save } from 'lucide-svelte';
	import {
		cnameTargetForProvider,
		formatPublishUrlHint,
		SLUG_MAX_LENGTH,
		SLUG_PATTERN,
		SLUG_TITLE,
		slugValidationMessage,
		type HostProvider,
		type PublishMode
	} from '$lib/publishing';
	import { formatPurgeCountdown } from '$lib/purge-countdown';
	import type { PageTheme } from '$lib/theme-config';

	let {
		project,
		modes,
		providers,
		providerReady,
		providerLabels
	}: {
		project: {
			id: string;
			name: string;
			slug: string;
			description: string | null;
			publishMode: PublishMode;
			hostProvider: HostProvider;
			publishBaseDomain: string | null;
			publishPathPrefix: string;
			teamId: string;
			theme: PageTheme;
			deployUrl: string | null;
			deployProviderId: string | null;
			lastDeployError: string | null;
			lastDeployedAt: Date | string | null;
			published: boolean;
			checkDetailsEnabled: boolean;
			checkDetailsIncludeErrors: boolean;
			deletedAt: Date | string | null;
			undeleteExpiresAt: Date | string | null;
			canManageLifecycle?: boolean;
		};
		modes: readonly PublishMode[];
		providers: readonly HostProvider[];
		providerReady: Record<string, boolean>;
		providerLabels: Record<string, string>;
	} = $props();

	let draftSlug = $state('');
	let draftMode = $state<PublishMode>('path');
	let draftProvider = $state<HostProvider>('vercel');
	let draftBaseDomain = $state('');
	let draftPathPrefix = $state('s');
	let draftLogoUrl = $state('');
	let logoPreviewFailed = $state(false);
	let confirmInput = $state('');
	let draftCheckDetails = $state(false);

	$effect(() => {
		draftSlug = project.slug;
		draftMode = project.publishMode;
		draftProvider = project.hostProvider;
		draftBaseDomain = project.publishBaseDomain ?? '';
		draftPathPrefix = project.publishPathPrefix || 's';
		draftLogoUrl = project.theme.logoUrl;
		draftCheckDetails = project.checkDetailsEnabled;
		logoPreviewFailed = false;
	});

	const isDeleted = $derived(!!project.deletedAt);
	const logoPreviewUrl = $derived(draftLogoUrl.trim());

	const urlHint = $derived(
		formatPublishUrlHint({
			slug: draftSlug,
			publishMode: draftMode,
			hostProvider: draftProvider,
			pathPrefix: draftPathPrefix,
			apexDomain: draftBaseDomain
		})
	);

	const cnameTarget = $derived(
		cnameTargetForProvider(draftProvider, {
			deployProviderId: draftProvider === project.hostProvider ? project.deployProviderId : null,
			deployUrl: draftProvider === project.hostProvider ? project.deployUrl : null
		})
	);

	const slugError = $derived(slugValidationMessage(draftSlug.trim().toLowerCase()));
</script>

<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
	<div class="flex items-center gap-2 mb-1.5 flex-wrap">
		<h2 class="text-lg font-semibold m-0">{project.name}</h2>
		{#if isDeleted}
			<span
				class="inline-block text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-error-500 text-white"
				>Deleted</span
			>
		{:else if !project.published}
			<span
				class="inline-block text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-warning-500 text-white"
				>Unpublished</span
			>
		{/if}
	</div>

	{#if isDeleted}
		{#if project.canManageLifecycle}
			<p class="text-sm text-surface-500 mb-3">
				This project has been soft-deleted.
				{#if project.undeleteExpiresAt}
					It will be permanently removed after {new Date(
						project.undeleteExpiresAt
					).toLocaleDateString()}
					({formatPurgeCountdown(project.undeleteExpiresAt)}).
				{:else}
					You have a 7-day grace period to restore it.
				{/if}
			</p>
			<div class="flex flex-wrap gap-2">
				<form method="post" action="?/undelete" use:enhance>
					<input type="hidden" name="id" value={project.id} />
					<button class="btn preset-filled-primary-500" type="submit">Restore project</button>
				</form>
				<form
					method="post"
					action="?/purge"
					use:enhance={({ cancel }) => {
						const ok = confirm(`Permanently delete "${project.name}"? This cannot be undone.`);
						if (!ok) cancel();
					}}
				>
					<input type="hidden" name="id" value={project.id} />
					<button class="btn preset-filled-error-500" type="submit">Purge</button>
				</form>
			</div>
		{:else}
			<p class="text-sm text-surface-500">This project has been deleted.</p>
		{/if}
	{:else}
		<p class="text-sm text-surface-500 mb-2">
			Hint: <code>{urlHint}</code>
		</p>
		{#if project.deployUrl}
			<p class="text-sm text-surface-500 mb-2">
				Live: <a href={project.deployUrl}>{project.deployUrl}</a>
			</p>
		{/if}
		{#if draftMode === 'subdomain'}
			{#if draftBaseDomain}
				<p class="text-sm text-surface-500">
					DNS: CNAME <code>{draftSlug || '<slug>'}.{draftBaseDomain}</code> →
					<code>{cnameTarget}</code>
				</p>
			{:else}
				<p class="text-warning-500 text-sm">
					Set a base domain on this project for subdomain DNS hints.
				</p>
			{/if}
		{:else}
			<p class="text-sm text-surface-500">
				Path base: <code>/{draftPathPrefix}/{draftSlug || '<slug>'}</code>
			</p>
		{/if}
		{#if project.lastDeployError}
			<p class="text-error-500 text-sm">Last deploy error: {project.lastDeployError}</p>
		{/if}
		{#if project.lastDeployedAt}
			<p class="text-sm text-surface-500">
				Last deployed {new Date(project.lastDeployedAt).toLocaleString()}
			</p>
		{/if}

		<form
			id="project-update-{project.id}"
			method="post"
			action="?/update"
			use:enhance
			class="flex flex-col gap-3 mt-4"
		>
			<input type="hidden" name="id" value={project.id} />
			<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
				<label class="label">
					<span class="label-text">Name</span>
					<input class="input" name="name" value={project.name} required />
				</label>
				<label class="label">
					<span class="label-text">Slug</span>
					<input
						class="input"
						name="slug"
						bind:value={draftSlug}
						required
						maxlength={SLUG_MAX_LENGTH}
						pattern={SLUG_PATTERN}
						title={SLUG_TITLE}
						aria-invalid={slugError ? 'true' : undefined}
					/>
					{#if draftSlug && slugError}
						<span class="text-error-500 text-xs mt-1">{slugError}</span>
					{/if}
				</label>
				<label class="label">
					<span class="label-text">Publish mode</span>
					<select class="select" name="publishMode" bind:value={draftMode}>
						{#each modes as mode (mode)}
							<option value={mode}>{mode}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span class="label-text">Host provider</span>
					<select class="select" name="hostProvider" bind:value={draftProvider}>
						{#each providers as provider (provider)}
							<option value={provider}>{providerLabels[provider] ?? provider}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span class="label-text">Base domain</span>
					<input
						class="input"
						name="publishBaseDomain"
						bind:value={draftBaseDomain}
						placeholder="status.example.com"
						autocomplete="off"
					/>
				</label>
				<label class="label">
					<span class="label-text">Path prefix</span>
					<input
						class="input"
						name="publishPathPrefix"
						bind:value={draftPathPrefix}
						required
						pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
						autocomplete="off"
					/>
				</label>
			</div>
			<label class="label">
				<span class="label-text">Description</span>
				<input class="input" name="description" value={project.description ?? ''} />
			</label>
			<h3 class="text-base font-semibold mt-2 mb-1">Check details</h3>
			<div class="flex flex-col gap-2">
				<label class="label flex flex-row items-start gap-2">
					<input
						class="checkbox mt-1"
						type="checkbox"
						name="checkDetailsEnabled"
						bind:checked={draftCheckDetails}
					/>
					<span class="label-text">
						Let visitors open check details
						<span class="block text-surface-500 text-xs font-normal">
							Clicking a bar on the uptime history shows that day's uptime, how many checks ran, and
							when they failed.
						</span>
					</span>
				</label>
				<label class="label flex flex-row items-start gap-2">
					<input
						class="checkbox mt-1"
						type="checkbox"
						name="checkDetailsIncludeErrors"
						checked={project.checkDetailsIncludeErrors}
						disabled={!draftCheckDetails}
					/>
					<span class="label-text" class:opacity-50={!draftCheckDetails}>
						Include status codes and error messages
						<span class="block text-surface-500 text-xs font-normal">
							Also shows the probe target and the raw error text. Database and TCP errors can name
							internal hosts and ports, so leave this off for a public page.
						</span>
					</span>
				</label>
				<p class="text-surface-500 text-xs m-0">
					Your team always sees the full detail in the project preview.
				</p>
			</div>
			<h3 class="text-base font-semibold mt-2 mb-1">Theme</h3>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
				<label class="label">
					<span class="label-text">Brand name</span>
					<input class="input" name="themeBrandName" value={project.theme.brandName} />
				</label>
				<label class="label">
					<span class="label-text">Logo URL</span>
					<input
						class="input"
						name="themeLogoUrl"
						bind:value={draftLogoUrl}
						placeholder="https://... (replaces brand name)"
						oninput={() => {
							logoPreviewFailed = false;
						}}
					/>
					{#if logoPreviewUrl && !logoPreviewFailed}
						<img
							src={logoPreviewUrl}
							alt=""
							class="mt-2 max-h-12 max-w-48 object-contain rounded border border-surface-200-800 bg-surface-50-950 p-1"
							onerror={() => {
								logoPreviewFailed = true;
							}}
						/>
					{/if}
				</label>
				<label class="label">
					<span class="label-text">Font family</span>
					<input class="input" name="themeFontFamily" value={project.theme.fontFamily} />
				</label>
			</div>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2">
				<label class="label text-xs gap-1">
					<span class="label-text">BG</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorBg"
						type="color"
						value={project.theme.colors.bg}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Ink</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorInk"
						type="color"
						value={project.theme.colors.ink}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Accent</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorAccent"
						type="color"
						value={project.theme.colors.accent}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">OK</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorOk"
						type="color"
						value={project.theme.colors.ok}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Warn</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorWarn"
						type="color"
						value={project.theme.colors.warn}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Bad</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorBad"
						type="color"
						value={project.theme.colors.bad}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Muted</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorMuted"
						type="color"
						value={project.theme.colors.muted}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Line</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorLine"
						type="color"
						value={project.theme.colors.line}
					/>
				</label>
			</div>
		</form>

		<div class="flex flex-nowrap items-center gap-2 mt-3 overflow-x-auto">
			<button
				class="btn-icon preset-filled-primary-500 shrink-0"
				type="submit"
				form="project-update-{project.id}"
				aria-label="Save"
			>
				<Save size={18} strokeWidth={2} aria-hidden="true" />
			</button>
			<a
				class="btn-icon preset-outlined-secondary-500 shrink-0"
				href="/dashboard/preview/{project.slug}"
				target="_blank"
				rel="noopener"
				aria-label="Preview"
			>
				<Eye size={18} strokeWidth={2} aria-hidden="true" />
			</a>
		</div>
		{#if !providerReady[draftProvider]}
			<p class="text-sm text-surface-500 mt-2 mb-0">
				Provider credentials not configured. Add them in <a href="/dashboard/settings">Settings</a>.
			</p>
		{/if}

		{#if project.canManageLifecycle}
			<details class="mt-4 border-t border-surface-200-800 pt-3">
				<summary class="text-sm text-surface-500 cursor-pointer select-none">Delete project</summary
				>
				<div class="mt-2">
					<p class="text-sm text-surface-500 mb-2">
						Type <strong>{project.name}</strong> to confirm deletion. You will have 7 days to restore
						it.
					</p>
					<form method="post" action="?/softDelete" use:enhance>
						<input type="hidden" name="id" value={project.id} />
						<div class="flex gap-2 items-center flex-wrap">
							<input
								class="input flex-1 min-w-48"
								name="confirmName"
								bind:value={confirmInput}
								placeholder={project.name}
							/>
							<button
								class="btn preset-filled-error-500"
								type="submit"
								disabled={confirmInput !== project.name}>Delete</button
							>
						</div>
					</form>
				</div>
			</details>
		{/if}
	{/if}
</div>
