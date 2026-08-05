<script lang="ts">
	import type { UptimeDayBucket } from './uptime';

	let {
		buckets,
		days = 90
	}: {
		buckets: UptimeDayBucket[];
		days?: number;
	} = $props();

	let tip = $state<{
		x: number;
		label: string;
		detail: string;
	} | null>(null);

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
</script>

{#if buckets.length > 0}
	<div class="uptime-history">
		<div
			class="uptime-bars"
			role="img"
			aria-label="{days}-day uptime history"
			onmouseleave={hideTip}
		>
			{#each buckets as bucket (bucket.date)}
				<button
					type="button"
					class="bar tone-{barTone(bucket)}"
					aria-label="{formatDayLabel(bucket.date)}: {formatPercent(bucket.uptime)}"
					onmouseenter={(e) => showTip(e, bucket)}
					onfocus={(e) => showTip(e, bucket)}
					onblur={hideTip}
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
	</div>
{/if}

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
</style>
