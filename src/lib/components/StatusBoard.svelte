<script lang="ts">
	import StatusPill from '$lib/components/StatusPill.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import SubscribeButton from '$lib/components/SubscribeButton.svelte';
	import UptimeHistoryGraph from '$lib/components/UptimeHistoryGraph.svelte';
	import type { UptimeDayBucket } from '$lib/uptime';
	import type { CheckDayDetail } from '$lib/check-detail';

	let {
		data
	}: {
		data: {
			page: {
				name: string;
				description: string | null;
				slug: string;
				checkDetailsEnabled: boolean;
			};
			basePath: string;
			overall: string;
			overallLabel: string;
			services: Array<{
				id: string;
				name: string;
				description: string | null;
				status: import('$lib/status').ServiceStatus;
				uptime90d: number | null;
			}>;
			uptimeByService: Record<string, UptimeDayBucket[]>;
			activeIncidents: Array<{
				id: string;
				title: string;
				status: string;
				impact: string;
				createdAt: Date | string;
			}>;
			recentIncidents: Array<{
				id: string;
				title: string;
				resolvedAt: Date | string | null;
				updatedAt: Date | string;
			}>;
		};
	} = $props();

	function formatUptime(value: number | null): string {
		if (value === null) return '';
		return `${(value * 100).toFixed(2)}% uptime`;
	}

	function formatDate(value: Date | string | null | undefined): string {
		if (!value) return '';
		return new Date(value).toLocaleString();
	}

	async function loadCheckDetail(serviceId: string, date: string): Promise<CheckDayDetail> {
		const res = await fetch(`/api/v1/pages/${data.page.slug}/services/${serviceId}/days/${date}`);
		if (!res.ok) throw new Error(`Could not load check detail (${res.status})`);
		const json = (await res.json()) as { detail: CheckDayDetail };
		return json.detail;
	}

	const incidentHref = (id: string) =>
		data.basePath ? `${data.basePath}/incidents/${id}` : `/incidents/${id}`;

	const dotClass = $derived(
		data.overall === 'major_outage'
			? 'w-3 h-3 rounded-full shrink-0 bg-error-500'
			: data.overall === 'degraded' || data.overall === 'partial_outage'
				? 'w-3 h-3 rounded-full shrink-0 bg-warning-500'
				: 'w-3 h-3 rounded-full shrink-0 bg-success-500'
	);
</script>

<svelte:head>
	<title>{data.page.name}</title>
	{#if data.page.description}
		<meta name="description" content={data.page.description} />
	{/if}
</svelte:head>

<div class="mx-auto w-[min(880px,calc(100%-2rem))]">
	<header
		class="flex justify-between items-center gap-4 pt-7 pb-5 border-b border-surface-200-800 mb-6"
	>
		<div>
			<a class="text-2xl font-bold tracking-tight no-underline" href={data.basePath || '/'}>
				{data.page.name}
			</a>
			{#if data.page.description}
				<p class="text-surface-500 text-sm mt-1 m-0">{data.page.description}</p>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			<SubscribeButton pageSlug={data.page.slug} />
			<ThemeToggle />
		</div>
	</header>

	<section
		class="flex items-center gap-3 p-4 border border-surface-200-800 rounded-md mb-6"
		aria-live="polite"
	>
		<span class={dotClass} aria-hidden="true"></span>
		<div>
			<h2 class="m-0 text-lg font-semibold">{data.overallLabel}</h2>
			<p class="text-surface-500 text-sm mt-0.5 m-0">Updated {new Date().toLocaleString()}</p>
		</div>
	</section>

	{#if data.activeIncidents.length > 0}
		<section class="mb-8">
			<h2 class="text-sm uppercase tracking-[0.04em] text-surface-500 m-0 mb-3">
				Active incidents
			</h2>
			{#each data.activeIncidents as incident (incident.id)}
				<article class="py-3 border-b border-surface-200-800">
					<h3 class="m-0 text-base font-semibold">
						<a href={incidentHref(incident.id)}>{incident.title}</a>
					</h3>
					<p class="text-surface-500 text-sm mt-0.5 m-0">
						{incident.status} · {incident.impact} impact · {formatDate(incident.createdAt)}
					</p>
				</article>
			{/each}
		</section>
	{/if}

	<section class="mb-8">
		<h2 class="text-sm uppercase tracking-[0.04em] text-surface-500 m-0 mb-3">Services</h2>
		{#if data.services.length === 0}
			<p class="text-surface-500">No services configured yet.</p>
		{:else}
			<div class="border border-surface-200-800 rounded-md overflow-hidden mb-4">
				{#each data.services as item (item.id)}
					<div class="flex flex-col gap-0.5 px-4 py-4 not-last:border-b border-surface-200-800">
						<div class="grid grid-cols-[1fr_auto] gap-4 items-start">
							<div>
								<div class="font-semibold">{item.name}</div>
								{#if item.description}
									<p class="mt-1 text-surface-500 text-sm m-0">{item.description}</p>
								{/if}
								{#if item.uptime90d !== null}
									<p class="mt-1 text-surface-500 text-sm m-0">{formatUptime(item.uptime90d)}</p>
								{/if}
							</div>
							<StatusPill status={item.status} />
						</div>
						{#if data.uptimeByService[item.id]}
							<UptimeHistoryGraph
								buckets={data.uptimeByService[item.id]}
								loadDetail={data.page.checkDetailsEnabled
									? (date) => loadCheckDetail(item.id, date)
									: null}
							/>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</section>

	{#if data.recentIncidents.length > 0}
		<section class="mb-8">
			<h2 class="text-sm uppercase tracking-[0.04em] text-surface-500 m-0 mb-3">Past incidents</h2>
			{#each data.recentIncidents as incident (incident.id)}
				<article class="py-3 border-b border-surface-200-800">
					<h3 class="m-0 text-base font-semibold">
						<a href={incidentHref(incident.id)}>{incident.title}</a>
					</h3>
					<p class="text-surface-500 text-sm mt-0.5 m-0">
						Resolved · {formatDate(incident.resolvedAt ?? incident.updatedAt)}
					</p>
				</article>
			{/each}
		</section>
	{/if}

	<footer class="py-8 text-surface-500 text-sm border-t border-surface-200-800">
		<span
			>Powered by <a href="https://skinnystatus.app" target="_blank" rel="noopener noreferrer"
				>SkinnyStatus</a
			></span
		>
	</footer>
</div>
