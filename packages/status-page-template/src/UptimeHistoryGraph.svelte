<script lang="ts">
	import type { UptimeDayBucket } from './uptime';
	import type { CheckDayDetail, CheckFailureRun } from './check-detail';

	let {
		buckets,
		days = 90,
		loadDetail = null
	}: {
		buckets: UptimeDayBucket[];
		days?: number;
		/** Supply a loader to make the bars open a detail panel on click. */
		loadDetail?: ((date: string) => Promise<CheckDayDetail>) | null;
	} = $props();

	const uid = $props.id();
	const panelId = `${uid}-detail`;
	const interactive = $derived(loadDetail !== null);

	let tip = $state<{
		x: number;
		label: string;
		detail: string;
	} | null>(null);

	let selected = $state<string | null>(null);
	let detail = $state<CheckDayDetail | null>(null);
	let loading = $state(false);
	let loadError = $state<string | null>(null);
	let requestId = 0;

	function barTone(bucket: UptimeDayBucket): 'ok' | 'warn' | 'bad' | 'empty' {
		if (bucket.uptime === null) return 'empty';
		if (bucket.uptime >= 0.99) return 'ok';
		if (bucket.uptime >= 0.95) return 'warn';
		return 'bad';
	}

	function formatPercent(value: number | null): string {
		if (value === null) return 'No data';
		return `${(value * 100).toFixed(2)}% uptime`;
	}

	function formatDayLabel(isoDate: string): string {
		const d = new Date(`${isoDate}T12:00:00Z`);
		return d.toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function showTip(event: MouseEvent | FocusEvent, bucket: UptimeDayBucket) {
		const target = event.currentTarget as HTMLElement;
		const host = target.closest('.uptime-history') as HTMLElement | null;
		if (!host) return;
		const hostBox = host.getBoundingClientRect();
		const barBox = target.getBoundingClientRect();
		tip = {
			x: barBox.left + barBox.width / 2 - hostBox.left,
			label: formatDayLabel(bucket.date),
			detail: formatPercent(bucket.uptime)
		};
	}

	function hideTip() {
		tip = null;
	}

	function close() {
		requestId += 1;
		selected = null;
		detail = null;
		loadError = null;
		loading = false;
	}

	async function select(date: string) {
		if (!loadDetail) return;
		if (selected === date) {
			close();
			return;
		}
		selected = date;
		detail = null;
		loadError = null;
		loading = true;
		const token = ++requestId;
		try {
			const result = await loadDetail(date);
			if (token !== requestId) return;
			detail = result;
		} catch (err) {
			if (token !== requestId) return;
			loadError = err instanceof Error ? err.message : 'Could not load check detail';
		} finally {
			if (token === requestId) loading = false;
		}
	}

	/** Times render in UTC because the bars are UTC calendar days. */
	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString(undefined, {
			hour12: false,
			timeZone: 'UTC'
		});
	}

	function formatWindow(run: CheckFailureRun): string {
		if (run.from === run.to) return formatTime(run.from);
		return `${formatTime(run.from)} to ${formatTime(run.to)}`;
	}

	function plural(count: number, word: string): string {
		return `${count} ${word}${count === 1 ? '' : 's'}`;
	}
</script>

{#if buckets.length > 0}
	<div class="uptime-history">
		<div
			class="uptime-bars"
			role={interactive ? 'group' : 'img'}
			aria-label="{days}-day uptime history"
			onmouseleave={hideTip}
		>
			{#each buckets as bucket (bucket.date)}
				<button
					type="button"
					class="bar tone-{barTone(bucket)}"
					class:selected={selected === bucket.date}
					aria-label="{formatDayLabel(bucket.date)}: {formatPercent(bucket.uptime)}"
					aria-expanded={interactive ? selected === bucket.date : undefined}
					aria-controls={interactive ? panelId : undefined}
					onmouseenter={(e) => showTip(e, bucket)}
					onfocus={(e) => showTip(e, bucket)}
					onblur={hideTip}
					onclick={() => select(bucket.date)}
				></button>
			{/each}
			{#if tip}
				<div class="tip" style="left: {tip.x}px" role="tooltip">
					<strong>{tip.label}</strong>
					<span>{tip.detail}</span>
				</div>
			{/if}
		</div>
		<div class="uptime-axis">
			<span>{days} days ago</span>
			<span>Today</span>
		</div>

		{#if interactive && selected}
			<section class="detail" id={panelId} aria-live="polite">
				<header class="detail-head">
					<div>
						<strong>{formatDayLabel(selected)}</strong>
						<span class="detail-sub">Times in UTC</span>
					</div>
					<button type="button" class="detail-close" onclick={close}>Close</button>
				</header>

				{#if loading}
					<p class="detail-note">Loading check detail…</p>
				{:else if loadError}
					<p class="detail-note detail-note-bad">{loadError}</p>
				{:else if detail}
					<dl class="detail-grid">
						<div>
							<dt>Check</dt>
							<dd>{detail.checkLabel ?? 'No automated check'}</dd>
						</div>
						{#if detail.checkTarget}
							<div>
								<dt>Target</dt>
								<dd class="detail-mono">{detail.checkTarget}</dd>
							</div>
						{/if}
						{#if detail.expectedStatus !== null}
							<div>
								<dt>Expected status</dt>
								<dd class="detail-mono">{detail.expectedStatus}</dd>
							</div>
						{/if}
						<div>
							<dt>Uptime</dt>
							<dd>{formatPercent(detail.uptime)}</dd>
						</div>
						<div>
							<dt>Checks run</dt>
							<dd>{detail.total}{detail.failed > 0 ? ` (${detail.failed} failed)` : ''}</dd>
						</div>
						{#if detail.latencyMs}
							<div>
								<dt>Response time</dt>
								<dd>
									{detail.latencyMs.min}–{detail.latencyMs.max} ms, {detail.latencyMs.avg} ms avg
								</dd>
							</div>
						{/if}
					</dl>

					{#if detail.total === 0}
						<p class="detail-note">No checks were recorded on this day.</p>
					{:else if detail.failureRuns.length === 0}
						<p class="detail-note">Every check passed on this day.</p>
					{:else}
						<h4 class="detail-heading">
							{detail.failureRunsTruncated
								? `Most recent ${detail.failureRuns.length} failure windows`
								: plural(detail.failureRuns.length, 'failure window')}
						</h4>
						<ul class="detail-list">
							{#each detail.failureRuns as run (run.from)}
								<li>
									<span class="detail-mono">{formatWindow(run)}</span>
									<span class="detail-sub">{plural(run.count, 'check')}</span>
									{#if run.statusCode !== null}
										<span class="detail-code">HTTP {run.statusCode}</span>
									{/if}
									{#if run.error}
										<span class="detail-error">{run.error}</span>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}

					{#if detail.latestCheck}
						<h4 class="detail-heading">Most recent check for this service</h4>
						<p class="detail-latest">
							<span class="detail-mono"
								>{new Date(detail.latestCheck.checkedAt).toLocaleString()}</span
							>
							<span class={detail.latestCheck.ok ? 'detail-ok' : 'detail-error'}>
								{detail.latestCheck.ok ? 'Passed' : 'Failed'}
							</span>
							{#if detail.latestCheck.latencyMs !== null}
								<span class="detail-sub">{detail.latestCheck.latencyMs} ms</span>
							{/if}
							{#if detail.latestCheck.statusCode !== null}
								<span class="detail-code">HTTP {detail.latestCheck.statusCode}</span>
							{/if}
							{#if detail.latestCheck.error}
								<span class="detail-error">{detail.latestCheck.error}</span>
							{/if}
						</p>
					{/if}
				{/if}
			</section>
		{/if}
	</div>
{/if}

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && selected) close();
	}}
/>

<style>
	.uptime-history {
		position: relative;
		width: 100%;
		margin-top: 0.55rem;
	}

	.uptime-bars {
		position: relative;
		display: flex;
		align-items: stretch;
		gap: 1px;
		height: 2.15rem;
		width: 100%;
	}

	.bar {
		flex: 1 1 0;
		min-width: 0;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		border-radius: 1px;
		background: color-mix(in srgb, var(--color-success-500) 88%, transparent);
	}

	.bar:focus-visible {
		outline: 2px solid var(--color-surface-900-50, var(--color-surface-900));
		outline-offset: 1px;
		z-index: 1;
	}

	.bar.selected {
		outline: 2px solid var(--color-surface-900-50, var(--color-surface-900));
		outline-offset: 1px;
		z-index: 1;
	}

	.bar.tone-empty {
		background: color-mix(in srgb, var(--color-surface-400) 55%, transparent);
	}

	.bar.tone-warn {
		background: var(--color-warning-500);
	}

	.bar.tone-bad {
		background: var(--color-error-500);
	}

	.tip {
		position: absolute;
		bottom: calc(100% + 0.45rem);
		transform: translateX(-50%);
		z-index: 5;
		display: grid;
		gap: 0.1rem;
		min-width: 9.5rem;
		max-width: 14rem;
		padding: 0.45rem 0.6rem;
		border-radius: 6px;
		border: 1px solid var(--color-surface-600);
		background: var(--color-surface-800);
		color: var(--color-surface-100);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
		pointer-events: none;
		text-align: center;
		font-size: 0.78rem;
		line-height: 1.25;
	}

	.tip strong {
		font-weight: 600;
	}

	.tip span {
		color: var(--color-surface-400);
	}

	.uptime-axis {
		display: flex;
		justify-content: space-between;
		margin-top: 0.35rem;
		color: var(--color-surface-500);
		font-size: 0.75rem;
	}

	.detail {
		margin-top: 0.75rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--color-surface-300-700, var(--color-surface-600));
		border-radius: 8px;
		font-size: 0.8rem;
		line-height: 1.45;
	}

	.detail-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}

	.detail-head strong {
		font-weight: 600;
	}

	.detail-close {
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		color: var(--color-surface-500);
		font-size: 0.78rem;
		text-decoration: underline;
	}

	.detail-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0.55rem 1.25rem;
		margin: 0 0 0.75rem;
	}

	.detail-grid dt {
		color: var(--color-surface-500);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.detail-grid dd {
		margin: 0.1rem 0 0;
	}

	.detail-heading {
		margin: 0.75rem 0 0.4rem;
		font-size: 0.72rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-surface-500);
	}

	.detail-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.35rem;
	}

	.detail-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--color-surface-200-800, var(--color-surface-700));
	}

	.detail-list li:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.detail-latest {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem;
		margin: 0;
	}

	.detail-mono {
		font-family: 'Cascadia Mono', ui-monospace, monospace;
		font-size: 0.76rem;
		overflow-wrap: anywhere;
	}

	.detail-sub {
		color: var(--color-surface-500);
		font-size: 0.75rem;
	}

	.detail-code {
		font-family: 'Cascadia Mono', ui-monospace, monospace;
		font-size: 0.72rem;
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
		background: var(--color-surface-200-800, var(--color-surface-700));
	}

	.detail-ok {
		color: var(--color-success-600);
	}

	.detail-error {
		color: var(--color-error-500);
		overflow-wrap: anywhere;
	}

	.detail-note {
		margin: 0;
		color: var(--color-surface-500);
	}

	.detail-note-bad {
		color: var(--color-error-500);
	}
</style>
