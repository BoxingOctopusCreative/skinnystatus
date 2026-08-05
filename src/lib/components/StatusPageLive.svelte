<script lang="ts">
	import type { PageTheme } from '$lib/theme-config';
	import { DEFAULT_PAGE_THEME } from '$lib/theme-config';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import SubscribeButton from '$lib/components/SubscribeButton.svelte';
	import UptimeHistoryGraph from '$lib/components/UptimeHistoryGraph.svelte';
	import type { UptimeDayBucket } from '$lib/uptime';

	type PagePayload = {
		page: { slug: string; name: string; description: string | null; theme: PageTheme };
		overall: string;
		overallLabel: string;
		services: Array<{
			id: string;
			name: string;
			description: string | null;
			status: string;
			uptime90d: number | null;
		}>;
		activeIncidents: Array<{
			id: string;
			title: string;
			status: string;
			impact: string;
			createdAt: string;
		}>;
		recentIncidents: Array<{
			id: string;
			title: string;
			resolvedAt: string | null;
			updatedAt: string;
		}>;
		updatedAt: string;
	};

	let {
		apiBase,
		pageSlug,
		basePath = '',
		theme = DEFAULT_PAGE_THEME,
		pollIntervalMs = 60_000,
		preview = false
	}: {
		apiBase: string;
		pageSlug: string;
		basePath?: string;
		theme?: PageTheme;
		pollIntervalMs?: number;
		preview?: boolean;
	} = $props();

	let data = $state<PagePayload | null>(null);
	let uptime = $state<Record<string, UptimeDayBucket[]>>({});
	let error = $state<string | null>(null);
	let incidentView = $state<{
		id: string;
		title: string;
		status: string;
		impact: string;
		updates: Array<{ id: string; body: string; status: string; createdAt: string }>;
	} | null>(null);

	async function load() {
		try {
			const base = apiBase.replace(/\/$/, '');
			const [pageRes, upRes] = await Promise.all([
				fetch(`${base}/api/v1/pages/${pageSlug}`),
				fetch(`${base}/api/v1/pages/${pageSlug}/uptime?days=90`)
			]);
			if (!pageRes.ok) throw new Error(`Status API returned ${pageRes.status}`);
			const pageJson = (await pageRes.json()) as PagePayload;
			data = pageJson;

			if (upRes.ok) {
				const upJson = (await upRes.json()) as {
					services: Array<{ id: string; buckets: UptimeDayBucket[] }>;
				};
				const map: Record<string, UptimeDayBucket[]> = {};
				for (const c of upJson.services) map[c.id] = c.buckets;
				uptime = map;
			}
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load status';
		}
	}

	async function openIncident(id: string) {
		const base = apiBase.replace(/\/$/, '');
		const res = await fetch(`${base}/api/v1/pages/${pageSlug}/incidents/${id}`);
		if (!res.ok) return;
		const json = (await res.json()) as { incident: NonNullable<typeof incidentView> };
		incidentView = json.incident;
	}

	function formatUptime(value: number | null): string {
		if (value === null) return 'No data';
		return `${(value * 100).toFixed(2)}%`;
	}

	$effect(() => {
		void load();
		const timer = setInterval(() => void load(), pollIntervalMs);
		return () => clearInterval(timer);
	});

	const activeTheme = $derived(
		data?.page.theme?.colors ? data.page.theme : theme
	);

	const brand = $derived(
		data?.page.theme?.brandName || theme.brandName || data?.page.name || 'Status'
	);
	/** Empty logoUrl on the page theme means no logo - do not fall back to the default mark. */
	const logo = $derived(
		data?.page.theme ? (data.page.theme.logoUrl || '') : theme.logoUrl || ''
	);

	const dotClass = $derived(
		data?.overall === 'major_outage'
			? 'w-3 h-3 rounded-full shrink-0 bg-error-500'
			: data?.overall === 'degraded' || data?.overall === 'partial_outage'
				? 'w-3 h-3 rounded-full shrink-0 bg-warning-500'
				: 'w-3 h-3 rounded-full shrink-0 bg-success-500'
	);

	const rootStyle = $derived(
		`--tenant-accent: ${activeTheme.colors.accent}; --tenant-ok: ${activeTheme.colors.ok}; --tenant-warn: ${activeTheme.colors.warn}; --tenant-bad: ${activeTheme.colors.bad}; --tenant-bg: ${activeTheme.colors.bg}; --tenant-ink: ${activeTheme.colors.ink}; --tenant-muted: ${activeTheme.colors.muted}; --tenant-line: ${activeTheme.colors.line}; font-family: ${activeTheme.fontFamily};`
	);
</script>


<div class="status-live status-theme-bridge" style={rootStyle}>
	{#if preview}
		<div class="preview-banner" role="status">
			<strong>Preview</strong>
			<span>This is how the status page will look when deployed. Live data from the API.</span>
			<a href="/dashboard/projects">Back to projects</a>
		</div>
	{/if}

	<div class="mx-auto w-[min(880px,calc(100%-2rem))]">
		<header class="flex justify-between items-center gap-4 pt-7 pb-5 border-b border-(--tenant-line) mb-6">
			<div>
				<a class="brand" href={basePath || '#'}>
					{#if logo}
						<img src={logo} alt={brand} class="h-7 w-auto" />
					{:else}
						{brand}
					{/if}
				</a>
				{#if data?.page.description}
					<p class="text-sm mt-1 m-0" style="color: var(--tenant-muted)">{data.page.description}</p>
				{/if}
			</div>
			<div class="flex items-center gap-3">
				<SubscribeButton apiBase={apiBase} {pageSlug} />
			</div>
		</header>

		{#if error}
			<p class="py-4 text-error-500">{error}</p>
		{:else if !data}
			<p class="text-sm" style="color: var(--tenant-muted)">Loading status...</p>
		{:else if incidentView}
			<section class="mb-8">
				<p class="mb-3">
					<button type="button" class="linkish" onclick={() => (incidentView = null)}>
						&larr; Back
					</button>
				</p>
				<h2 class="incident-title">{incidentView.title}</h2>
				<p class="text-sm mt-1" style="color: var(--tenant-muted)">
					{incidentView.status} · {incidentView.impact} impact
				</p>
				{#each incidentView.updates as update (update.id)}
					<article class="py-3 border-b border-(--tenant-line)">
						<p class="m-0">{update.body}</p>
						<p class="text-sm mt-1 m-0" style="color: var(--tenant-muted)">
							{update.status} · {new Date(update.createdAt).toLocaleString()}
						</p>
					</article>
				{/each}
			</section>
		{:else}
			<section class="flex items-center gap-3 p-4 border border-(--tenant-line) rounded-md mb-6" aria-live="polite">
				<span class={dotClass} aria-hidden="true"></span>
				<div>
					<h2 class="m-0 text-lg font-semibold">{data.overallLabel}</h2>
					<p class="text-sm mt-0.5 m-0" style="color: var(--tenant-muted)">
						Updated {new Date(data.updatedAt).toLocaleString()}
					</p>
				</div>
			</section>

			{#if data.activeIncidents.length > 0}
				<section class="mb-8">
					<h2 class="section-label">Active incidents</h2>
					{#each data.activeIncidents as incident (incident.id)}
						<article class="py-3 border-b border-(--tenant-line)">
							<h3 class="m-0 text-base font-semibold">
								<button type="button" class="linkish" onclick={() => openIncident(incident.id)}>
									{incident.title}
								</button>
							</h3>
							<p class="text-sm mt-0.5 m-0" style="color: var(--tenant-muted)">
								{incident.status} · {incident.impact} · {new Date(incident.createdAt).toLocaleString()}
							</p>
						</article>
					{/each}
				</section>
			{/if}

			<section class="mb-8">
				<h2 class="section-label">Services</h2>
				<div class="border border-(--tenant-line) rounded-md overflow-hidden mb-4">
					{#each data.services as item (item.id)}
						<div class="flex flex-col gap-0.5 px-4 py-4 not-last:border-b border-(--tenant-line)">
							<div class="grid grid-cols-[1fr_auto] gap-4 items-start">
								<div>
									<div class="font-semibold">{item.name}</div>
									{#if item.description}
										<p class="mt-1 text-sm m-0" style="color: var(--tenant-muted)">{item.description}</p>
									{/if}
									{#if item.uptime90d !== null}
										<p class="mt-1 text-sm m-0" style="color: var(--tenant-muted)">
											{formatUptime(item.uptime90d)} uptime
										</p>
									{/if}
								</div>
								<StatusPill status={item.status as import('$lib/status').ServiceStatus} />
							</div>
							{#if uptime[item.id]}
								<UptimeHistoryGraph buckets={uptime[item.id]} />
							{/if}
						</div>
					{/each}
				</div>
			</section>

			{#if data.recentIncidents.length > 0}
				<section class="mb-8">
					<h2 class="section-label">Past incidents</h2>
					{#each data.recentIncidents as incident (incident.id)}
						<article class="py-3 border-b border-(--tenant-line)">
							<h3 class="m-0 text-base font-semibold">
								<button type="button" class="linkish" onclick={() => openIncident(incident.id)}>
									{incident.title}
								</button>
							</h3>
							<p class="text-sm mt-0.5 m-0" style="color: var(--tenant-muted)">
								Resolved · {new Date(incident.resolvedAt ?? incident.updatedAt).toLocaleString()}
							</p>
						</article>
					{/each}
				</section>
			{/if}
		{/if}

		<footer class="py-8 text-sm border-t border-(--tenant-line)" style="color: var(--tenant-muted)">
			<span>Powered by <a href="https://skinnystatus.app" target="_blank" rel="noopener noreferrer">SkinnyStatus</a></span>
		</footer>
	</div>
</div>

<style>
	.status-live {
		min-height: 100vh;
		background:
			radial-gradient(
				1200px 500px at 10% -10%,
				color-mix(in srgb, var(--tenant-accent) 12%, var(--tenant-bg)) 0%,
				transparent 55%
			),
			var(--tenant-bg);
		color: var(--tenant-ink);
		line-height: 1.5;
	}

	.preview-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1rem;
		padding: 0.65rem 1.25rem;
		background: color-mix(in srgb, var(--tenant-accent) 12%, var(--tenant-bg));
		border-bottom: 1px solid var(--tenant-line);
		font-size: 0.9rem;
		color: var(--tenant-ink);
	}

	.preview-banner a {
		margin-left: auto;
		color: var(--tenant-accent);
	}

	.brand {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--tenant-ink);
		text-decoration: none;
		letter-spacing: -0.03em;
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.section-label {
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--tenant-muted);
		margin: 0 0 0.75rem;
	}

	.incident-title {
		font-size: 1.35rem;
		margin: 0 0 0.35rem;
		color: var(--tenant-ink);
	}

	.linkish {
		background: none;
		border: none;
		padding: 0;
		color: var(--tenant-accent);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-align: left;
		text-decoration: underline;
		text-underline-offset: 2px;
	}
</style>
