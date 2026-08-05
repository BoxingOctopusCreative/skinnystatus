<script lang="ts">
	import { enhance } from '$app/forms';
	import { Trash2 } from 'lucide-svelte';
	import PagePicker from '$lib/components/PagePicker.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function formatDate(value: Date | string | null | undefined): string {
		if (!value) return '';
		return new Date(value).toLocaleString();
	}
</script>

<svelte:head>
	<title>Incidents · {data.team.name}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-4">Incidents</h1>

{#if data.pages.length === 0}
	<p class="text-sm text-surface-500 mb-4">
		No projects on this team yet.
		<a href="/dashboard/projects?team={data.team.id}">Create a project</a> before managing incidents.
	</p>
{:else}
	<PagePicker pages={data.pages} pageId={data.pageId} />
{/if}

{#if form?.message}
	<p class="text-error-500 text-sm mb-3">{form.message}</p>
{/if}

<details class="add-incident-pull border-b border-surface-200-800 py-3 mt-5 mb-5">
	<summary
		class="add-incident-summary flex items-center justify-between gap-3 flex-wrap cursor-pointer list-none"
	>
		<span class="text-lg font-semibold min-w-0 mr-auto">Create Incident</span>
	</summary>
	<form method="post" action="?/create" use:enhance class="flex flex-col gap-3 mt-4 pl-1">
		<input type="hidden" name="statusPageId" value={data.pageId} />
		<label class="label">
			<span class="label-text">Title</span>
			<input class="input" name="title" required />
		</label>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
			<label class="label">
				<span class="label-text">Status</span>
				<select class="select" name="status">
					{#each data.statuses as status (status)}
						<option value={status}>{status}</option>
					{/each}
				</select>
			</label>
			<label class="label">
				<span class="label-text">Impact</span>
				<select class="select" name="impact">
					{#each data.impacts as impact (impact)}
						<option value={impact}>{impact}</option>
					{/each}
				</select>
			</label>
		</div>
		<label class="label">
			<span class="label-text">Initial update</span>
			<textarea class="textarea" name="body" required placeholder="We are investigating..."></textarea>
		</label>
		{#if data.services.length > 0}
			<fieldset class="border-0 p-0 m-0">
				<legend class="text-sm text-surface-500 mb-1.5 px-0">Affected services</legend>
				<div class="flex flex-col gap-1.5">
					{#each data.services as c (c.id)}
						<label class="inline-flex items-center gap-2 text-sm">
							<input type="checkbox" class="checkbox" name="serviceIds" value={c.id} />
							{c.name}
						</label>
					{/each}
				</div>
			</fieldset>
		{/if}
		<div>
			<button class="btn preset-filled-primary-500" type="submit">Create</button>
		</div>
	</form>
</details>

<section class="mt-5 mb-5">
	<h2 class="text-lg font-semibold mb-3">Existing Incidents</h2>

	{#if data.incidents.length === 0}
		<p class="text-sm text-surface-500 m-0">No incidents yet.</p>
	{:else}
		{#each data.incidents as i (i.id)}
			<div class="border-b border-surface-200-800 py-4">
				<h3 class="text-lg font-semibold m-0">
					<a
						href={data.incidentPathPrefix
							? `${data.incidentPathPrefix}/incidents/${i.id}`
							: `${data.pageUrl}/incidents/${i.id}`}>{i.title}</a
					>
				</h3>
				<p class="text-sm text-surface-500 m-0">
					{i.status} · {i.impact} · {formatDate(i.createdAt)}
				</p>

				<ul class="pl-5 my-4 flex flex-col gap-2">
					{#each i.updates as update (update.id)}
						<li>
							<span class="text-sm text-surface-500"
								>{update.status} · {formatDate(update.createdAt)}</span
							>
							<div>{update.body}</div>
						</li>
					{/each}
				</ul>

				<form method="post" action="?/addUpdate" use:enhance class="flex flex-col gap-3">
					<input type="hidden" name="incidentId" value={i.id} />
					<label class="label">
						<span class="label-text">Add update</span>
						<textarea class="textarea" name="body" required></textarea>
					</label>
					<label class="label">
						<span class="label-text">Status</span>
						<select class="select" name="status">
							{#each data.statuses as status (status)}
								<option value={status} selected={status === i.status}>{status}</option>
							{/each}
						</select>
					</label>
					<div>
						<button class="btn preset-filled-primary-500" type="submit">Post update</button>
					</div>
				</form>
				<div class="flex flex-nowrap items-center gap-2 mt-3">
					<form method="post" action="?/delete" use:enhance class="shrink-0">
						<input type="hidden" name="id" value={i.id} />
						<button class="btn-icon preset-filled-error-500" type="submit" aria-label="Delete">
							<Trash2 size={18} strokeWidth={2} aria-hidden="true" />
						</button>
					</form>
				</div>
			</div>
		{/each}
	{/if}
</section>

<style>
	.add-incident-summary::-webkit-details-marker {
		display: none;
	}

	.add-incident-summary::after {
		content: '';
		display: inline-block;
		width: 0.4rem;
		height: 0.4rem;
		margin-left: 0.35rem;
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: rotate(45deg);
		opacity: 0.65;
		flex-shrink: 0;
		align-self: center;
	}

	details[open] > .add-incident-summary::after {
		transform: rotate(-135deg);
		margin-top: 0.2rem;
	}
</style>
