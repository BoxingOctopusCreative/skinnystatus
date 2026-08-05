<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Billing</title>
</svelte:head>

<h1 class="text-2xl font-bold mb-2">Billing</h1>
<p class="text-sm text-surface-500 mb-5">
	Plan limits apply to your billing org. Status page caps are per team. Prices are CAD monthly.
</p>

{#if data.checkout === 'success'}
	<p class="text-success-500 text-sm mb-3">Checkout complete. Your plan updates when Stripe confirms.</p>
{/if}
{#if data.checkout === 'cancel'}
	<p class="text-surface-500 text-sm mb-3">Checkout canceled. Your plan is unchanged.</p>
{/if}
{#if form?.message}
	<p class="text-error-500 text-sm mb-3">{form.message}</p>
{/if}

<div class="card preset-filled-surface-100-900 p-5 mb-6 border border-surface-200-800">
	<div class="flex flex-wrap items-baseline justify-between gap-3 mb-4">
		<div>
			<h2 class="text-lg font-semibold m-0">{data.org.planName}</h2>
			<p class="text-sm text-surface-500 m-0 mt-1">{data.org.priceLabel}</p>
		</div>
		{#if data.canManage && data.org.hasStripeCustomer && data.stripeReady}
			<form method="post" action="?/portal" use:enhance>
				<button class="btn preset-outlined-secondary-500" type="submit">Manage billing</button>
			</form>
		{/if}
	</div>

	{#if data.org.subscriptionStatus}
		<p class="text-sm text-surface-500 m-0 mb-4">
			Subscription status: <code>{data.org.subscriptionStatus}</code>
			{#if data.org.currentPeriodEnd}
				· period ends {new Date(data.org.currentPeriodEnd).toLocaleDateString()}
			{/if}
		</p>
	{/if}

	<ul class="list-none m-0 p-0 grid gap-2 text-sm">
		<li class="flex justify-between gap-4 border-b border-surface-200-800 pb-2">
			<span>Teams</span>
			<span class="font-mono-status"
				>{data.usage.teams.used} / {data.usage.teams.limit}</span
			>
		</li>
		<li class="flex justify-between gap-4 border-b border-surface-200-800 pb-2">
			<span
				>Status pages{#if data.teamName}
					<span class="text-surface-500"> ({data.teamName})</span>{/if}</span
			>
			<span class="font-mono-status"
				>{data.usage.pagesOnTeam.used} / {data.usage.pagesOnTeam.limit}</span
			>
		</li>
		{#if data.usage.servicesOnPage}
			<li class="flex justify-between gap-4">
				<span>Services on selected page</span>
				<span class="font-mono-status"
					>{data.usage.servicesOnPage.used} / {data.usage.servicesOnPage.limit}</span
				>
			</li>
		{/if}
	</ul>
</div>

{#if !data.stripeReady}
	<p class="text-sm text-surface-500 mb-5">
		Stripe is not configured on this install. Set <code>STRIPE_SECRET_KEY</code> and price IDs to
		enable upgrades.
	</p>
{/if}

<h2 class="text-lg font-semibold mb-3">Plans</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
	{#each data.plans as plan (plan.id)}
		<div
			class="border border-surface-200-800 p-4 flex flex-col gap-3 {plan.current
				? 'ring-1 ring-primary-500'
				: ''}"
		>
			<div>
				<p class="m-0 font-semibold text-[1.05rem]">{plan.name}</p>
				<p class="m-0 mt-1 text-sm text-surface-500">{plan.priceLabel}</p>
				<p class="m-0 mt-2 text-sm text-surface-500">{plan.tagline}</p>
			</div>
			<ul class="list-none m-0 p-0 text-sm text-surface-500 flex flex-col gap-1">
				<li>{plan.maxTeams} team{plan.maxTeams === 1 ? '' : 's'}</li>
				<li>{plan.maxStatusPagesPerTeam} status pages per team</li>
				<li>{plan.maxServicesPerStatusPage} services per page</li>
				{#if plan.sso}
					<li>Custom SSO (coming soon)</li>
				{/if}
			</ul>
			{#if plan.current}
				<p class="text-sm font-semibold text-primary-500 m-0 mt-auto">Current plan</p>
			{:else if plan.id === 'free'}
				<p class="text-sm text-surface-500 m-0 mt-auto">
					Use Manage billing to cancel a paid plan.
				</p>
			{:else if data.canManage && data.stripeReady && data.availablePrices[plan.id]}
				<form method="post" action="?/checkout" use:enhance class="mt-auto">
					<input type="hidden" name="planId" value={plan.id} />
					<button class="btn preset-filled-primary-500 w-full" type="submit"
						>Upgrade to {plan.name}</button
					>
				</form>
			{:else if data.canManage && data.stripeReady}
				<p class="text-sm text-surface-500 m-0 mt-auto">Price ID not configured for this tier.</p>
			{:else if !data.canManage}
				<p class="text-sm text-surface-500 m-0 mt-auto">Ask an org admin to change the plan.</p>
			{/if}
		</div>
	{/each}
</div>
