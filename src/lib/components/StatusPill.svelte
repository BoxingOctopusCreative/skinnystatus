<script lang="ts">
	import type { ServiceStatus } from '$lib/status';

	let {
		status,
		label
	}: {
		status: ServiceStatus;
		label?: string;
	} = $props();

	const text = $derived(
		label ??
			status
				.split('_')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ')
	);

	const cls = $derived(
		status === 'operational'
			? 'badge preset-filled-success-500'
			: status === 'degraded' || status === 'partial_outage'
				? 'badge preset-filled-warning-500'
				: status === 'major_outage'
					? 'badge preset-filled-error-500'
					: 'badge preset-filled-tertiary-500'
	);
</script>

<span class={cls}>{text}</span>
