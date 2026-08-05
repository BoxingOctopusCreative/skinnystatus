<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Create your team · Dashboard</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-2">{data.hasTeams ? 'Create a team' : 'Create your team'}</h1>
<p class="text-sm text-surface-500 mb-5">
	{#if data.hasTeams}
		Projects, services, and deploy credentials live under a team. You can invite people later from Settings.
	{:else}
		Every account belongs to a team. Projects, services, and deploy credentials live under that team.
		You can invite people later from Settings.
	{/if}
</p>

{#if form?.message}
	<p class="text-error-500 text-sm mb-3">
		{form.message}
		{#if 'upgrade' in form && form.upgrade}
			<a class="underline ml-1" href="/dashboard/billing">Upgrade</a>
		{/if}
	</p>
{/if}

<form method="post" use:enhance class="flex flex-col gap-3 max-w-md">
	<label class="label">
		<span class="label-text">Team name</span>
		<input
			class="input"
			type="text"
			name="name"
			required
			value={data.suggestedName}
			placeholder="e.g. Platform Ops"
		/>
	</label>
	<div>
		<button class="btn preset-filled-primary-500" type="submit">Create team</button>
	</div>
</form>
