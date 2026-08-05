<script lang="ts">
	import * as Sentry from '@sentry/sveltekit';

	async function throwClientError() {
		await Sentry.startSpan({ name: 'Sentry Example Frontend Span', op: 'test' }, async () => {
			const res = await fetch('/sentry-example');
			if (!res.ok) {
				throw new Error('Sentry Example Frontend Error');
			}
		});
	}
</script>

<main class="mx-auto max-w-lg space-y-4 p-8">
	<h1 class="text-2xl font-semibold">Sentry example</h1>
	<p class="text-sm opacity-80">Dev-only page to verify errors and traces reach Sentry.</p>
	<button type="button" class="btn preset-filled-primary-500" onclick={throwClientError}>
		Throw error with trace
	</button>
</main>
