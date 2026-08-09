<script lang="ts">
	import { enhance } from '$app/forms';
	import { Save, Trash2 } from 'lucide-svelte';
	import CheckConfigFields from '$lib/components/CheckConfigFields.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import PagePicker from '$lib/components/PagePicker.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

{#snippet testResult(target: string)}
	{#if form && 'testOutcome' in form && form.testTarget === target}
		{@const outcome = form.testOutcome}
		<p
			class="text-sm mt-2 mb-0 {outcome.ok ? 'text-success-600-400' : 'text-error-500'}"
			aria-live="polite"
		>
			<strong>{outcome.ok ? 'Check passed' : 'Check failed'}</strong>
			{#if outcome.statusCode !== null}
				· HTTP {outcome.statusCode}
			{/if}
			{#if outcome.latencyMs !== null}
				· {outcome.latencyMs} ms
			{/if}
			{#if outcome.error}
				· {outcome.error}
			{/if}
		</p>
	{/if}
{/snippet}

<svelte:head>
	<title>Services · {data.team.name}</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-4">Services</h1>

{#if data.pages.length === 0}
	<p class="text-sm text-surface-500 mb-4">
		No projects on this team yet.
		<a href="/dashboard/projects?team={data.team.id}">Create a project</a> before adding services.
	</p>
{:else}
	<PagePicker pages={data.pages} pageId={data.pageId} />
{/if}

{#if form?.message}
	<p class="text-error-500 text-sm mb-3">
		{form.message}
		{#if 'upgrade' in form && form.upgrade}
			<a class="underline ml-1" href="/dashboard/billing">Upgrade</a>
		{/if}
	</p>
{/if}

<details class="add-service-pull border-b border-surface-200-800 py-3 mt-5 mb-5">
	<summary
		class="add-service-summary flex items-center justify-between gap-3 flex-wrap cursor-pointer list-none"
	>
		<span class="text-lg font-semibold min-w-0 mr-auto">Add Service</span>
	</summary>
	<form method="post" action="?/create" use:enhance class="flex flex-col gap-3 mt-4 pl-1">
		<input type="hidden" name="statusPageId" value={data.pageId} />
		<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
			<label class="label">
				<span class="label-text">Name</span>
				<input class="input" name="name" required />
			</label>
			<label class="label">
				<span class="label-text">Sort order</span>
				<input class="input" name="sortOrder" type="number" value="0" />
			</label>
		</div>
		<label class="label">
			<span class="label-text">Description</span>
			<input class="input" name="description" />
		</label>
		<CheckConfigFields
			checkTypes={data.checkTypes}
			dnsRecordTypes={data.dnsRecordTypes}
			initialType=""
			settings={null}
		/>
		<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
			<label class="label">
				<span class="label-text">Manual override</span>
				<select class="select" name="manualStatus">
					<option value="">None (auto)</option>
					{#each data.statuses as status (status)}
						<option value={status}>{status}</option>
					{/each}
				</select>
			</label>
		</div>
		<div class="flex items-center gap-2">
			<button class="btn preset-filled-primary-500" type="submit">Create</button>
			<button class="btn preset-tonal" type="submit" formaction="?/test">Test check now</button>
		</div>
		{@render testResult('new')}
	</form>
</details>

<section class="mt-5 mb-5">
	<h2 class="text-lg font-semibold mb-3">Existing Services</h2>

	{#if data.services.length === 0}
		<p class="text-sm text-surface-500 m-0">No services yet.</p>
	{:else}
		{#each data.services as c (c.id)}
			<div class="border-b border-surface-200-800 py-4">
				<div class="flex justify-between gap-4 items-center mb-4">
					<h3 class="text-lg font-semibold m-0">{c.name}</h3>
					<StatusPill status={c.status} />
				</div>
				<form
					id="service-update-{c.id}"
					method="post"
					action="?/update"
					use:enhance
					class="flex flex-col gap-3"
				>
					<input type="hidden" name="id" value={c.id} />
					<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
						<label class="label">
							<span class="label-text">Name</span>
							<input class="input" name="name" value={c.name} required />
						</label>
						<label class="label">
							<span class="label-text">Sort order</span>
							<input class="input" name="sortOrder" type="number" value={c.sortOrder} />
						</label>
					</div>
					<label class="label">
						<span class="label-text">Description</span>
						<input class="input" name="description" value={c.description ?? ''} />
					</label>
					<CheckConfigFields
						checkTypes={data.checkTypes}
						dnsRecordTypes={data.dnsRecordTypes}
						initialType={c.checkType ?? ''}
						settings={c.checkSettings}
						checkUrl={c.checkUrl}
						expectedStatus={c.expectedStatus}
					/>
					<div class="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
						<label class="label">
							<span class="label-text">Manual override</span>
							<select class="select" name="manualStatus">
								<option value="" selected={!c.manualStatus}>None (auto)</option>
								{#each data.statuses as status (status)}
									<option value={status} selected={c.manualStatus === status}>{status}</option>
								{/each}
							</select>
						</label>
					</div>
				</form>
				<div class="flex flex-nowrap items-center gap-2 mt-3">
					<button
						class="btn-icon preset-filled-primary-500 shrink-0"
						type="submit"
						form="service-update-{c.id}"
						aria-label="Save"
					>
						<Save size={18} strokeWidth={2} aria-hidden="true" />
					</button>
					<button
						class="btn preset-tonal shrink-0"
						type="submit"
						form="service-update-{c.id}"
						formaction="?/test"
					>
						Test check now
					</button>
					<form method="post" action="?/delete" use:enhance class="shrink-0">
						<input type="hidden" name="id" value={c.id} />
						<button class="btn-icon preset-filled-error-500" type="submit" aria-label="Delete">
							<Trash2 size={18} strokeWidth={2} aria-hidden="true" />
						</button>
					</form>
				</div>
				{@render testResult(c.id)}
			</div>
		{/each}
	{/if}
</section>

<style>
	.add-service-summary::-webkit-details-marker {
		display: none;
	}

	.add-service-summary::after {
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

	details[open] > .add-service-summary::after {
		transform: rotate(-135deg);
		margin-top: 0.2rem;
	}
</style>
