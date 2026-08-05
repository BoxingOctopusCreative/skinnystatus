<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Team invite</title>
</svelte:head>

<div class="mx-auto w-[min(420px,calc(100%-2rem))] mt-16 pb-12">
	<div class="card preset-filled-surface-100-900 p-5 border border-surface-200-800">
		{#if data.invalid}
			<h1 class="text-2xl font-bold mt-0 mb-3">Invite unavailable</h1>
			<p class="text-sm text-surface-500">This invite link is invalid, expired, or already used.</p>
			<p class="text-sm text-surface-500 mt-4">
				<a href="/dashboard/login">Sign in</a>
			</p>
		{:else if data.acceptError}
			<h1 class="text-2xl font-bold mt-0 mb-3">Could not join {data.teamName}</h1>
			<p class="text-error-500 text-sm">{data.acceptError}</p>
			<p class="text-sm text-surface-500 mt-4">
				<a href="/dashboard">Go to dashboard</a>
			</p>
		{:else}
			<h1 class="text-2xl font-bold mt-0 mb-3">Joining team...</h1>
		{/if}
	</div>
</div>
