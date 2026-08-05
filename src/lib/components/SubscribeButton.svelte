<script lang="ts">
	let {
		apiBase = '',
		pageSlug
	}: {
		apiBase?: string;
		pageSlug: string;
	} = $props();

	let open = $state(false);
	let email = $state('');
	let pending = $state(false);
	let message = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function submit(e: Event) {
		e.preventDefault();
		pending = true;
		message = null;
		error = null;
		try {
			const base = apiBase.replace(/\/$/, '');
			const res = await fetch(`${base}/api/v1/pages/${pageSlug}/subscribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
			if (!res.ok) {
				error = json.error ?? 'Could not subscribe';
				return;
			}
			message = json.message ?? 'Subscribed.';
			email = '';
		} catch {
			error = 'Could not reach the subscription service.';
		} finally {
			pending = false;
		}
	}

	function close() {
		open = false;
		message = null;
		error = null;
	}
</script>

<div class="relative">
	<button
		type="button"
		class="btn preset-outlined-secondary-500"
		onclick={() => (open = !open)}
	>
		Subscribe
	</button>

	{#if open}
		<div
			class="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(20rem,calc(100vw-2rem))] p-4 card shadow-xl"
			role="dialog"
			aria-label="Subscribe to status alerts"
		>
			<p class="text-surface-500 text-sm m-0 mb-3">
				Get email alerts when incidents are opened or updated.
			</p>
			<form onsubmit={submit} class="flex flex-col gap-3">
				<label class="label">
					<span class="label-text">Email</span>
					<input
						class="input"
						type="email"
						name="email"
						bind:value={email}
						required
						autocomplete="email"
						placeholder="you@example.com"
					/>
				</label>
				<div class="flex gap-2">
					<button type="submit" class="btn preset-filled-primary-500" disabled={pending}>
						{pending ? 'Subscribing...' : 'Subscribe'}
					</button>
					<button type="button" class="btn preset-outlined-secondary-500" onclick={close}>
						Cancel
					</button>
				</div>
			</form>
			{#if message}
				<p class="text-success-500 text-sm mt-3 m-0">{message}</p>
			{/if}
			{#if error}
				<p class="text-error-500 text-sm mt-3 m-0">{error}</p>
			{/if}
		</div>
	{/if}
</div>
