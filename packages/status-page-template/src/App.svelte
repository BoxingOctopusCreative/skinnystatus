<script lang="ts">
	import UptimeHistoryGraph from './UptimeHistoryGraph.svelte';
	import type { UptimeDayBucket } from './uptime';

	type Theme = {
		brandName: string;
		logoUrl: string;
		fontFamily: string;
		colors: Record<string, string>;
	};

	type Config = {
		apiBase: string;
		pageSlug: string;
		basePath: string;
		pollIntervalMs: number;
		theme: Theme;
	};

	type PagePayload = {
		page: { slug: string; name: string; description: string | null; theme: Theme };
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

	const boot = (window as unknown as { __SKINNY_STATUS__?: Config }).__SKINNY_STATUS__;
	const config: Config = boot ?? {
		apiBase: '',
		pageSlug: 'default',
		basePath: '',
		pollIntervalMs: 60000,
		theme: {
			brandName: '',
			logoUrl: 'https://assets.skinnystatus.app/brand/skinnystatus_wide.png',
			fontFamily: "'Jost', 'Segoe UI', sans-serif",
			colors: {
				bg: '#000000',
				ink: '#fcfcfc',
				accent: '#1ca048',
				ok: '#1ca048',
				warn: '#f59e0b',
				bad: '#ef4444',
				muted: '#909498',
				line: '#585858'
			}
		}
	};

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

	let subscribeOpen = $state(false);
	let subscribeEmail = $state('');
	let subscribePending = $state(false);
	let subscribeMessage = $state<string | null>(null);
	let subscribeError = $state<string | null>(null);

	async function subscribe(e: Event) {
		e.preventDefault();
		subscribePending = true;
		subscribeMessage = null;
		subscribeError = null;
		try {
			const base = config.apiBase.replace(/\/$/, '');
			const res = await fetch(`${base}/api/v1/pages/${config.pageSlug}/subscribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: subscribeEmail })
			});
			const json = (await res.json()) as { message?: string; error?: string };
			if (!res.ok) {
				subscribeError = json.error ?? 'Could not subscribe';
				return;
			}
			subscribeMessage = json.message ?? 'Subscribed.';
			subscribeEmail = '';
		} catch {
			subscribeError = 'Could not reach the subscription service.';
		} finally {
			subscribePending = false;
		}
	}

	async function load() {
		try {
			const base = config.apiBase.replace(/\/$/, '');
			const [pageRes, upRes] = await Promise.all([
				fetch(`${base}/api/v1/pages/${config.pageSlug}`),
				fetch(`${base}/api/v1/pages/${config.pageSlug}/uptime?days=90`)
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
		const base = config.apiBase.replace(/\/$/, '');
		const res = await fetch(`${base}/api/v1/pages/${config.pageSlug}/incidents/${id}`);
		if (!res.ok) return;
		const json = (await res.json()) as { incident: NonNullable<typeof incidentView> };
		incidentView = json.incident;
	}

	function formatUptime(value: number | null): string {
		if (value === null) return 'No data';
		return `${(value * 100).toFixed(2)}%`;
	}

	function statusBadgeClass(status: string): string {
		if (status === 'operational') return 'badge preset-filled-success-500';
		if (status === 'degraded' || status === 'partial_outage') return 'badge preset-filled-warning-500';
		if (status === 'major_outage') return 'badge preset-filled-error-500';
		return 'badge preset-filled-tertiary-500';
	}

	function statusLabel(status: string): string {
		return status
			.split('_')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	$effect(() => {
		void load();
		const timer = setInterval(() => void load(), config.pollIntervalMs);
		return () => clearInterval(timer);
	});

	const activeTheme = $derived(
		data?.page.theme?.colors ? data.page.theme : config.theme
	);

	const brand = $derived(
		data?.page.theme?.brandName ||
			config.theme.brandName ||
			data?.page.name ||
			'Status'
	);
	/** Empty logoUrl on the page theme means no logo - do not fall back to the default mark. */
	const logo = $derived(
		data?.page.theme ? data.page.theme.logoUrl || '' : config.theme.logoUrl || ''
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
	<div class="mx-auto w-[min(880px,calc(100%-2rem))]">
		<header
			class="flex justify-between items-center gap-4 pt-7 pb-5 border-b border-(--tenant-line) mb-6"
		>
			<div>
				<a class="brand" href={config.basePath || './'}>
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
			<div class="relative">
				<button
					type="button"
					class="btn preset-outlined-secondary-500"
					onclick={() => (subscribeOpen = !subscribeOpen)}>Subscribe</button
				>
				{#if subscribeOpen}
					<div
						class="card preset-filled-surface-100-900 border border-surface-200-800 absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(20rem,calc(100vw-2rem))] p-4"
						role="dialog"
						aria-label="Subscribe to status alerts"
					>
						<p class="text-sm text-surface-500 m-0 mb-3">
							Get email alerts when incidents are opened or updated.
						</p>
						<form onsubmit={subscribe}>
							<label class="label">
								<span class="label-text">Email</span>
								<input
									class="input"
									type="email"
									bind:value={subscribeEmail}
									required
									autocomplete="email"
									placeholder="you@example.com"
								/>
							</label>
							<div class="flex flex-wrap gap-2 mt-3">
								<button
									type="submit"
									class="btn preset-filled-primary-500"
									disabled={subscribePending}
									>{subscribePending ? 'Subscribing…' : 'Subscribe'}</button
								>
								<button
									type="button"
									class="btn preset-outlined-secondary-500"
									onclick={() => (subscribeOpen = false)}>Cancel</button
								>
							</div>
						</form>
						{#if subscribeMessage}
							<p class="text-success-500 text-sm mt-2 mb-0">{subscribeMessage}</p>
						{/if}
						{#if subscribeError}
							<p class="text-error-500 text-sm mt-2 mb-0">{subscribeError}</p>
						{/if}
					</div>
				{/if}
			</div>
		</header>

		{#if error}
			<p class="py-4 text-error-500">{error}</p>
		{:else if !data}
			<p class="text-sm" style="color: var(--tenant-muted)">Loading status…</p>
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
			<section
				class="flex items-center gap-3 p-4 border border-(--tenant-line) rounded-md mb-6"
				aria-live="polite"
			>
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
								{incident.status} · {incident.impact} · {new Date(
									incident.createdAt
								).toLocaleString()}
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
										<p class="mt-1 text-sm m-0" style="color: var(--tenant-muted)">
											{item.description}
										</p>
									{/if}
									{#if item.uptime90d !== null}
										<p class="mt-1 text-sm m-0 font-mono-status" style="color: var(--tenant-muted)">
											{formatUptime(item.uptime90d)} uptime
										</p>
									{/if}
								</div>
								<span class={statusBadgeClass(item.status)}>{statusLabel(item.status)}</span>
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
