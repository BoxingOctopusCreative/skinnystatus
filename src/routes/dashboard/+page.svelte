<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.team.name} · Dashboard</title>
</svelte:head>

<div class="flex flex-wrap items-start justify-between gap-4 mb-4">
	<div>
		<p class="m-0 mb-1 font-mono-status text-[0.75rem] tracking-[0.08em] uppercase text-primary-500">
			Team
		</p>
		<h1 class="text-2xl font-bold m-0">{data.team.name}</h1>
		<p class="text-sm text-surface-500 mt-1 mb-0">Your role: {data.team.role}</p>
	</div>
	<a class="btn preset-outlined-secondary-500" href="/dashboard/settings?team={data.team.id}">
		Manage team
	</a>
</div>

{#if data.bannerUrl}
	<div
		class="w-full rounded-lg bg-cover bg-center border border-surface-200-800 mb-6"
		style="background-image: url('{data.bannerUrl}'); height: clamp(8rem, 22vw, 14rem)"
		role="img"
		aria-label="{data.team.name} banner"
	></div>
{:else if data.canManage}
	<p class="text-sm text-surface-500 mb-6">
		No hero banner yet.
		<a href="/dashboard/settings?team={data.team.id}">Upload one</a> for this team landing page.
	</p>
{/if}

<div class="flex flex-wrap items-center justify-between gap-3 mb-4">
	<h2 class="text-lg font-semibold m-0">Projects</h2>
	{#if data.canManageLifecycle}
		<a class="btn preset-filled-primary-500" href="/dashboard/projects?team={data.team.id}">
			Manage projects
		</a>
	{:else}
		<a class="btn preset-outlined-secondary-500" href="/dashboard/projects?team={data.team.id}">
			View projects
		</a>
	{/if}
</div>

{#if data.projects.length === 0}
	<div class="card preset-filled-surface-100-900 p-5 border border-surface-200-800">
		<p class="text-surface-500 m-0">
			No projects on this team yet.
			{#if data.canManageLifecycle}
				<a href="/dashboard/projects?team={data.team.id}">Create one</a>.
			{/if}
		</p>
	</div>
{:else}
	<ul class="list-none m-0 p-0 flex flex-col">
		{#each data.projects as project (project.id)}
			<li class="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-surface-200-800">
				<div>
					<p class="m-0 font-semibold tracking-[-0.02em]">{project.name}</p>
					<p class="m-0 mt-1 text-sm text-surface-500">
						<code>{project.slug}</code>
						{#if project.deletedAt}
							· deleted
						{:else if !project.published}
							· unpublished
						{/if}
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<a
						class="btn preset-outlined-secondary-500"
						href="/dashboard/services?team={data.team.id}&page={project.id}"
					>
						Services
					</a>
					<a
						class="btn preset-outlined-secondary-500"
						href="/dashboard/incidents?team={data.team.id}&page={project.id}"
					>
						Incidents
					</a>
					<a
						class="btn preset-outlined-secondary-500"
						href="/dashboard/preview/{project.slug}"
						target="_blank"
						rel="noopener"
					>
						Preview
					</a>
				</div>
			</li>
		{/each}
	</ul>
{/if}
