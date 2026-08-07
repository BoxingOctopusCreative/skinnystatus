<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import { Settings } from 'lucide-svelte';
	import ProjectCard from '$lib/components/ProjectCard.svelte';
	import { checkTypeLabel, isCheckType, type PublicCheckSettings } from '$lib/checks';
	import { formatPurgeCountdown } from '$lib/purge-countdown';
	import {
		formatPublishUrlHint,
		SLUG_MAX_LENGTH,
		SLUG_PATTERN,
		SLUG_TITLE,
		slugValidationMessage,
		type HostProvider,
		type PublishMode
	} from '$lib/publishing';
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

	let createSlug = $state('');
	let createMode = $state<PublishMode>('path');
	let createProvider = $state<HostProvider>('vercel');
	let createBaseDomain = $state('');
	let createPathPrefix = $state('s');
	let projectDialog = $state<HTMLDialogElement | null>(null);
	let selectedProjectId = $state<string | null>(null);
	let expandedProjectIds = $state<Record<string, boolean>>({});

	const createHint = $derived(
		formatPublishUrlHint({
			slug: createSlug,
			publishMode: createMode,
			hostProvider: createProvider,
			pathPrefix: createPathPrefix,
			apexDomain: createBaseDomain
		})
	);

	const createSlugError = $derived(slugValidationMessage(createSlug.trim().toLowerCase()));

	const selectedProject = $derived(
		selectedProjectId
			? (data.projects.find((project) => project.id === selectedProjectId) ?? null)
			: null
	);

	const activeProjects = $derived(data.projects.filter((project) => project.deletedAt == null));

	const deletedProjects = $derived(
		data.projects
			.filter((project) => project.deletedAt != null)
			.slice()
			.sort((a, b) => {
				const aTime = new Date(a.deletedAt!).getTime();
				const bTime = new Date(b.deletedAt!).getTime();
				return bTime - aTime;
			})
	);

	type ServiceCheckSummary = {
		checkType: string | null;
		checkUrl: string | null;
		expectedStatus: number;
		manualStatus: string | null;
		checkSettings: PublicCheckSettings | null;
	};

	/** Compact read-only line for a service's check config. */
	function formatServiceCheckSummary(service: ServiceCheckSummary): string {
		const parts: string[] = [];

		if (!service.checkType || !isCheckType(service.checkType)) {
			parts.push('No check');
		} else {
			parts.push(checkTypeLabel(service.checkType));
			const settings = service.checkSettings;

			switch (settings?.type ?? service.checkType) {
				case 'http':
					if (service.checkUrl) parts.push(service.checkUrl);
					parts.push(`expect ${service.expectedStatus}`);
					break;
				case 'tcp':
					if (settings?.type === 'tcp') parts.push(`${settings.host}:${settings.port}`);
					break;
				case 'ssl':
					if (settings?.type === 'ssl') {
						parts.push(`${settings.host}:${settings.port}`);
						parts.push(`min ${settings.minDaysRemaining}d`);
					}
					break;
				case 'dns':
					if (settings?.type === 'dns') {
						parts.push(`${settings.recordType} ${settings.hostname}`);
						if (settings.expected) parts.push(`expect ${settings.expected}`);
					}
					break;
				case 'postgres':
				case 'mysql':
					if (settings?.type === 'postgres' || settings?.type === 'mysql') {
						parts.push(`${settings.host}:${settings.port}`);
						if (settings.database) parts.push(settings.database);
						if (settings.authenticated) {
							parts.push(settings.user ? `auth as ${settings.user}` : 'auth');
							if (settings.hasPassword) parts.push('password set');
						} else {
							parts.push('no auth');
						}
						if (settings.ssl) parts.push('SSL');
					}
					break;
				case 'redis':
					if (settings?.type === 'redis') {
						parts.push(`${settings.host}:${settings.port}`);
						if (settings.authenticated) {
							parts.push(settings.username ? `auth as ${settings.username}` : 'auth');
							if (settings.hasPassword) parts.push('password set');
						} else {
							parts.push('no auth');
						}
					}
					break;
			}
		}

		if (service.manualStatus) {
			parts.push(`manual: ${service.manualStatus}`);
		}

		return parts.join(' · ');
	}

	function toggleProjectServices(id: string) {
		expandedProjectIds[id] = !expandedProjectIds[id];
	}

	async function openProjectSettings(id: string) {
		selectedProjectId = id;
		await tick();
		projectDialog?.showModal();
	}

	function closeProject() {
		projectDialog?.close();
	}

	function onProjectDialogClose() {
		selectedProjectId = null;
	}

	function onProjectDialogClick(event: MouseEvent) {
		if (event.target === projectDialog) {
			closeProject();
		}
	}
</script>

<svelte:head>
	<title>Projects · {data.team.name}</title>
</svelte:head>

<div class="mb-2">
	<h1 class="text-2xl font-bold mb-1">Projects</h1>
	<p class="text-sm text-surface-500 m-0">
		Projects for <strong>{data.team.name}</strong>. Deploy a static app to your host; it polls
		the public API on this admin portal.
	</p>
</div>

{#if form?.message}
	<p class="text-error-500 text-sm mb-3">
		{form.message}
		{#if 'upgrade' in form && form.upgrade}
			<a class="underline ml-1" href="/dashboard/billing">Upgrade</a>
		{/if}
	</p>
{/if}
{#if form && 'deployedUrl' in form && form.deployedUrl}
	<p class="text-success-500 text-sm mb-3">
		Deployed to <a href={form.deployedUrl}>{form.deployedUrl}</a>
	</p>
{/if}
{#if form && 'customDomain' in form && form.customDomain}
	{#if form.customDomain.warning}
		<p class="text-warning-500 text-sm mb-3">
			Deploy succeeded, but custom domain registration failed:
			{form.customDomain.warning}
		</p>
	{:else if form.customDomain.registered}
		<p class="text-success-500 text-sm mb-3">
			Custom domain <code>{form.customDomain.hostname}</code> registered
			{#if form.customDomain.verified}
				and verified
			{:else if form.customDomain.cnameTarget}
				. Point a CNAME to <code>{form.customDomain.cnameTarget}</code> to finish DNS.
			{/if}
		</p>
	{/if}
{/if}

{#if data.canManageLifecycle}
	<details class="create-project-pull border-b border-surface-200-800 py-3 mt-5 mb-5">
		<summary
			class="create-project-summary flex items-center justify-between gap-3 flex-wrap cursor-pointer list-none"
		>
			<span class="text-lg font-semibold min-w-0 mr-auto">Create New Project</span>
		</summary>
		<p class="text-sm text-surface-500 mb-4 mt-4 pl-1">Hint: <code>{createHint}</code></p>
		<form method="post" action="?/create" use:enhance class="flex flex-col gap-3 pl-1">
			<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
				<label class="label">
					<span class="label-text">Name</span>
					<input class="input" name="name" required />
				</label>
				<label class="label">
					<span class="label-text">Slug</span>
					<input
						class="input"
						name="slug"
						bind:value={createSlug}
						required
						maxlength={SLUG_MAX_LENGTH}
						pattern={SLUG_PATTERN}
						title={SLUG_TITLE}
						placeholder="acme"
						aria-invalid={createSlugError ? 'true' : undefined}
					/>
					{#if createSlug && createSlugError}
						<span class="text-error-500 text-xs mt-1">{createSlugError}</span>
					{/if}
				</label>
				<label class="label">
					<span class="label-text">Publish mode</span>
					<select class="select" name="publishMode" bind:value={createMode}>
						{#each data.modes as mode (mode)}
							<option value={mode}>{mode}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span class="label-text">Host provider</span>
					<select class="select" name="hostProvider" bind:value={createProvider}>
						{#each data.providers as provider (provider)}
							<option value={provider}>{providerLabels[provider] ?? provider}</option>
						{/each}
					</select>
				</label>
				<label class="label">
					<span class="label-text">Base domain</span>
					<input
						class="input"
						name="publishBaseDomain"
						bind:value={createBaseDomain}
						placeholder="status.example.com"
						autocomplete="off"
					/>
				</label>
				<label class="label">
					<span class="label-text">Path prefix</span>
					<input
						class="input"
						name="publishPathPrefix"
						bind:value={createPathPrefix}
						required
						pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
						autocomplete="off"
					/>
				</label>
			</div>
			<label class="label">
				<span class="label-text">Description</span>
				<input class="input" name="description" />
			</label>
			<h3 class="text-base font-semibold mt-2 mb-1">Theme</h3>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
				<label class="label">
					<span class="label-text">Brand name</span>
					<input class="input" name="themeBrandName" placeholder="Acme Status" />
				</label>
				<label class="label">
					<span class="label-text">Logo URL</span>
					<input class="input" name="themeLogoUrl" placeholder="https://... (replaces brand name)" />
				</label>
				<label class="label">
					<span class="label-text">Font family</span>
					<input class="input" name="themeFontFamily" value={data.defaultTheme.fontFamily} />
				</label>
			</div>
			<div class="grid grid-cols-[repeat(auto-fit,minmax(70px,1fr))] gap-2">
				<label class="label text-xs gap-1">
					<span class="label-text">BG</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorBg"
						type="color"
						value={data.defaultTheme.colors.bg}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Ink</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorInk"
						type="color"
						value={data.defaultTheme.colors.ink}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Accent</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorAccent"
						type="color"
						value={data.defaultTheme.colors.accent}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">OK</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorOk"
						type="color"
						value={data.defaultTheme.colors.ok}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Warn</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorWarn"
						type="color"
						value={data.defaultTheme.colors.warn}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Bad</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorBad"
						type="color"
						value={data.defaultTheme.colors.bad}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Muted</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorMuted"
						type="color"
						value={data.defaultTheme.colors.muted}
					/>
				</label>
				<label class="label text-xs gap-1">
					<span class="label-text">Line</span>
					<input
						class="w-10 h-8 p-0 border border-surface-300-700 rounded"
						name="themeColorLine"
						type="color"
						value={data.defaultTheme.colors.line}
					/>
				</label>
			</div>
			<div>
				<button class="btn preset-filled-primary-500" type="submit">Create</button>
			</div>
		</form>
	</details>
{/if}

{#snippet projectRow(project: (typeof data.projects)[number])}
	{@const services = data.servicesByProjectId[project.id] ?? []}
	{@const expanded = !!expandedProjectIds[project.id]}
	<li class="border-b border-surface-200-800">
		<div class="flex flex-wrap items-center gap-2 py-3">
			<button
				type="button"
				class="project-expand flex-1 min-w-0 text-left flex items-center gap-2 flex-wrap bg-transparent border-0 p-0 cursor-pointer text-inherit"
				class:project-expand-open={expanded}
				aria-expanded={expanded}
				onclick={() => toggleProjectServices(project.id)}
			>
				<span class="font-semibold min-w-0">{project.name}</span>
				<code
					class="text-xs font-mono-status px-1.5 py-0.5 rounded bg-surface-200-800 text-surface-700-200"
					>{project.slug}</code
				>
				{#if project.deletedAt}
					<span
						class="inline-block text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-error-500 text-white"
						>Deleted</span
					>
					{#if project.undeleteExpiresAt}
						<span class="text-xs text-surface-500"
							>{formatPurgeCountdown(project.undeleteExpiresAt)}</span
						>
					{/if}
				{:else if !project.published}
					<span
						class="inline-block text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide bg-warning-500 text-white"
						>Unpublished</span
					>
				{/if}
			</button>
			<button
				class="btn-icon preset-outlined-secondary-500 shrink-0"
				type="button"
				aria-label="Settings"
				onclick={() => openProjectSettings(project.id)}
			>
				<Settings size={18} strokeWidth={2} aria-hidden="true" />
			</button>
			{#if project.deletedAt}
				<form
					method="post"
					action="?/purge"
					use:enhance={({ cancel }) => {
						const ok = confirm(
							`Permanently delete "${project.name}"? This cannot be undone.`
						);
						if (!ok) cancel();
					}}
					class="shrink-0"
				>
					<input type="hidden" name="id" value={project.id} />
					<button class="btn preset-filled-error-500" type="submit">Purge</button>
				</form>
			{:else}
				<form method="post" action="?/deploy" use:enhance class="shrink-0">
					<input type="hidden" name="id" value={project.id} />
					<input type="hidden" name="hostProvider" value={project.hostProvider} />
					<button
						class="btn preset-filled-primary-500"
						type="submit"
						disabled={!data.providerReady[project.hostProvider]}
					>
						Deploy
					</button>
				</form>
				<form method="post" action="?/setPublished" use:enhance class="shrink-0">
					<input type="hidden" name="id" value={project.id} />
					<input type="hidden" name="published" value={project.published ? 'false' : 'true'} />
					<button type="submit" class="btn preset-outlined-secondary-500">
						{project.published ? 'Unpublish' : 'Publish'}
					</button>
				</form>
			{/if}
		</div>
		{#if expanded}
			<div class="pb-3 pl-1">
				{#if services.length === 0}
					<p class="text-sm text-surface-500 m-0 mb-2">No services yet.</p>
				{:else}
					<ul class="m-0 mb-2 p-0 list-none flex flex-col gap-2">
						{#each services as service (service.id)}
							<li class="text-sm flex flex-col gap-0.5">
								<span class="font-medium">{service.name}</span>
								<p class="text-surface-500 m-0">
									{formatServiceCheckSummary(service)}
								</p>
							</li>
						{/each}
					</ul>
				{/if}
				<a class="text-sm" href="/dashboard/services?team={data.team.id}&page={project.id}">
					Manage services
				</a>
			</div>
		{/if}
	</li>
{/snippet}

<section class="mt-5 mb-5">
	<h2 class="text-lg font-semibold mb-3">Existing Projects</h2>

	{#if activeProjects.length === 0}
		<p class="text-sm text-surface-500 m-0">No projects yet.</p>
	{:else}
		<ul class="project-list flex flex-col m-0 p-0 list-none">
			{#each activeProjects as project (project.id)}
				{@render projectRow(project)}
			{/each}
		</ul>
	{/if}
</section>

{#if deletedProjects.length > 0}
	<section class="mt-5 mb-5">
		<h2 class="text-lg font-semibold mb-3">Deleted Projects</h2>
		<ul class="project-list flex flex-col m-0 p-0 list-none">
			{#each deletedProjects as project (project.id)}
				{@render projectRow(project)}
			{/each}
		</ul>
	</section>
{/if}

<dialog
	bind:this={projectDialog}
	class="project-dialog w-[min(920px,calc(100%-2rem))] max-h-[min(90vh,900px)] p-0 border border-surface-200-800 rounded-lg preset-filled-surface-50-950 text-inherit shadow-xl"
	onclick={onProjectDialogClick}
	onclose={onProjectDialogClose}
>
	{#if selectedProject}
		<div class="project-dialog-panel flex flex-col max-h-[min(90vh,900px)]">
			<div
				class="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-200-800 shrink-0"
			>
				<h2 class="text-lg font-semibold m-0 min-w-0 truncate">{selectedProject.name}</h2>
				<button class="btn preset-tonal" type="button" onclick={closeProject}>Close</button>
			</div>
			<div class="project-dialog-body overflow-y-auto p-4">
				{#key selectedProject.id}
					<ProjectCard
						project={selectedProject}
						modes={data.modes}
						providers={data.providers}
						providerReady={data.providerReady}
						{providerLabels}
					/>
				{/key}
			</div>
		</div>
	{/if}
</dialog>

<style>
	.create-project-summary::-webkit-details-marker {
		display: none;
	}

	.create-project-summary::after,
	.project-expand::after {
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

	details[open] > .create-project-summary::after,
	.project-expand-open::after {
		transform: rotate(-135deg);
		margin-top: 0.2rem;
	}

	.project-dialog {
		margin: auto;
	}

	.project-dialog::backdrop {
		background: rgb(0 0 0 / 0.45);
	}

	.project-dialog-body :global(.card) {
		margin-bottom: 0;
	}
</style>
