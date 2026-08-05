<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	const CREATE_TEAM = '__create_team__';

	let {
		teams,
		teamId
	}: {
		teams: Array<{ id: string; name: string }>;
		teamId: string;
	} = $props();

	function onTeamChange(value: string) {
		if (value === CREATE_TEAM) {
			void goto('/dashboard/teams/new');
			return;
		}
		const params = new URLSearchParams(page.url.searchParams);
		params.set('team', value);
		params.delete('page');
		void goto(`${page.url.pathname}?${params.toString()}`);
	}
</script>

{#if teams.length > 0}
	<label class="label team-switcher inline-flex items-center gap-2 m-0">
		<span class="label-text text-sm shrink-0">Team</span>
		<select
			class="select team-switcher-select"
			value={teamId}
			onchange={(e) => onTeamChange((e.currentTarget as HTMLSelectElement).value)}
		>
			{#each teams as t (t.id)}
				<option value={t.id}>{t.name}</option>
			{/each}
			<option value={CREATE_TEAM}>Create new Team</option>
		</select>
	</label>
{/if}

<style>
	.team-switcher {
		line-height: 1;
	}

	.team-switcher-select {
		width: auto;
		min-width: 10rem;
		max-width: min(20rem, 70vw);
		height: 2.5rem;
		min-height: 2.5rem;
		padding-block: 0.4rem;
		padding-inline: 0.75rem 2rem;
		line-height: 1.25;
		font-size: 0.875rem;
		box-sizing: border-box;
	}
</style>
