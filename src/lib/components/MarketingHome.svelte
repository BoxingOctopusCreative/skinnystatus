<script lang="ts">
	import AnimatedGridShell from '$lib/components/AnimatedGridShell.svelte';
	import { BRAND_LOGO_WIDE, BRAND_NAME, EXTERNAL_SERVICE_LOGOS_BASE } from '$lib/brand';
	import { PLAN_LIST, formatPlanPrice } from '$lib/plans';

	const barHeights = [92, 100, 100, 88, 100, 100, 95, 100, 70, 100, 100, 100, 100, 85, 100];
	const year = new Date().getFullYear();

	const hosts = [
		{ name: 'Vercel', slug: 'vercel' },
		{ name: 'Cloudflare Pages', slug: 'cloudflare' },
		{ name: 'Netlify', slug: 'netlify' },
		{ name: 'GitHub Pages', slug: 'github' },
		{ name: 'static.app', slug: 'staticapp' },
		{ name: 'Amazon S3', slug: 's3' },
		{ name: 'Firebase Hosting', slug: 'firebase' },
		{ name: 'Azure Static Web Apps', slug: 'azure' }
	] as const;
</script>

<AnimatedGridShell>
	<div class="relative z-10 mx-auto w-[min(1280px,calc(100%-2rem))] pb-12">
		<header class="flex items-center justify-end gap-4 py-5 animate-[rise_0.7s_ease_both]">
			<nav class="flex flex-wrap items-center justify-end gap-4">
				<a class="text-sm text-surface-500 no-underline hover:text-surface-950-50" href="#features"
					>Features</a
				>
				<a class="text-sm text-surface-500 no-underline hover:text-surface-950-50" href="#deploy"
					>Deploy</a
				>
				<a class="text-sm text-surface-500 no-underline hover:text-surface-950-50" href="#pricing"
					>Pricing</a
				>
				<a class="text-sm font-semibold text-primary-500 no-underline" href="/signup">Sign up</a>
				<a class="text-sm font-semibold text-primary-500 no-underline" href="/dashboard/login"
					>Sign in</a
				>
			</nav>
		</header>

		<section
			class="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center min-h-[min(72vh,640px)] py-6 pb-14 border-b border-surface-200-800"
		>
			<div class="animate-[rise_0.8s_ease_0.08s_both]">
				<img
					class="block w-[min(100%,34rem)] h-auto"
					src={BRAND_LOGO_WIDE}
					alt={BRAND_NAME}
					width="560"
					height="112"
				/>
				<p class="mt-5 max-w-136 text-[1.1rem] leading-[1.55] text-surface-500">
					One admin portal. Many branded status pages. Monitor services, publish static boards, and
					keep every tenant's uptime visible without redeploying on every check.
				</p>
				<div class="flex flex-wrap gap-[0.65rem] mt-7">
					<a class="btn preset-filled-primary-500" href="/signup">Get started</a>
					<a class="btn preset-outlined-secondary-500" href="/dashboard/login">Sign in</a>
				</div>
			</div>

			<div class="animate-[rise_0.9s_ease_0.18s_both]" aria-hidden="true">
				<div
					class="card preset-filled-surface-100-900 border border-surface-200-800 p-5 shadow-[0_12px_28px_rgba(0,0,0,0.18),0_32px_72px_rgba(0,0,0,0.28)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_12px_32px_rgba(0,0,0,0.85),0_40px_96px_rgba(0,0,0,0.9),0_0_80px_rgba(255,255,255,0.07)]"
				>
					<div
						class="flex justify-between items-baseline gap-4 mb-5 pb-[0.85rem] border-b border-surface-200-800"
					>
						<span class="font-bold tracking-[-0.03em]">acme.status</span>
						<span class="badge preset-filled-success-500 font-mono-status text-[0.7rem]"
							>All systems operational</span
						>
					</div>
					<div class="flex justify-between items-center text-[0.95rem] font-semibold mb-[0.45rem]">
						<span>API</span>
						<span
							class="inline-block w-[0.55rem] h-[0.55rem] rounded-full bg-success-500 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success-500)_25%,transparent)]"
						></span>
					</div>
					<div class="flex items-end gap-[3px] h-11 mb-[0.35rem]">
						{#each barHeights as h, i (i)}
							<span
								class="flex-1 rounded-[1px] origin-bottom bg-success-500"
								style="height:{h}%;animation:barIn 0.65s ease {i * 40}ms both"
							></span>
						{/each}
					</div>
					<div
						class="flex justify-between items-center text-[0.95rem] font-medium mt-[1.1rem] mb-[0.45rem] text-surface-500"
					>
						<span>Dashboard</span>
						<span
							class="inline-block w-[0.55rem] h-[0.55rem] rounded-full bg-success-500 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-success-500)_25%,transparent)]"
						></span>
					</div>
					<div class="flex items-end gap-[3px] h-11 mb-[0.35rem]">
						{#each barHeights as h, i (i)}
							<span
								class="flex-1 rounded-[1px] origin-bottom bg-success-500 opacity-70"
								style="height:{Math.max(60, h - 8)}%;animation:barIn 0.65s ease {i * 40 + 80}ms both"
							></span>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<section
			id="features"
			class="py-14 border-b border-surface-200-800 animate-[rise_0.7s_ease_both]"
		>
			<p
				class="m-0 mb-2 font-mono-status text-[0.75rem] tracking-[0.08em] uppercase text-primary-500"
			>
				Built for operators
			</p>
			<h2 class="m-0 text-[clamp(1.5rem,3vw,2rem)] tracking-[-0.03em] max-w-[22ch]">
				Everything you need to run status for many customers
			</h2>
			<p class="mt-[0.85rem] max-w-160 text-surface-500 text-[1.05rem]">
				SkinnyStatus is the control plane. Each project is a tenant status page you theme, preview,
				and ship.
			</p>

			<ul class="list-none m-0 mt-9 p-0 grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-7">
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">Projects as tenants</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Isolate services, incidents, and branding per customer or product line.</span
					>
				</li>
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">HTTP monitoring</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Interval checks with latency-aware degraded states and manual overrides.</span
					>
				</li>
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">Incident timeline</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Publish investigating to resolved updates that show on the live board.</span
					>
				</li>
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">90-day uptime bars</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Atlassian-style day cells with tooltips, fed from check history.</span
					>
				</li>
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">Themeable boards</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Fonts, colors, logo, and brand name. Preview before you publish.</span
					>
				</li>
				<li class="flex flex-col gap-[0.35rem]">
					<strong class="text-[1.05rem] tracking-[-0.02em]">Live JSON API</strong>
					<span class="text-surface-500 text-[0.95rem] leading-[1.45]"
						>Static pages poll the portal; status updates without a redeploy.</span
					>
				</li>
			</ul>
		</section>

		<section
			id="deploy"
			class="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center py-14 border-b border-surface-200-800 animate-[rise_0.7s_ease_both]"
		>
			<div>
				<p
					class="m-0 mb-2 font-mono-status text-[0.75rem] tracking-[0.08em] uppercase text-primary-500"
				>
					Publish anywhere
				</p>
				<h2 class="m-0 text-[clamp(1.5rem,3vw,2rem)] tracking-[-0.03em] max-w-[22ch]">
					One-click deploy to your host
				</h2>
				<p class="mt-[0.85rem] max-w-160 text-surface-500 text-[1.05rem]">
					Deploy a static status app to the host you connect. Use a path or subdomain per project.
					Your team stores host credentials in Settings, encrypted at rest.
				</p>
				<p class="mt-6 text-surface-500 text-[0.95rem]">
					Preview the board in the dashboard. Deploy when it looks right.
					<a href="/signup">Create an account</a> to manage projects.
				</p>
			</div>
			<ul
				class="m-0 p-0 list-none grid grid-cols-3 gap-x-8 gap-y-8 items-center justify-items-start"
				aria-label="Supported hosts"
			>
				{#each hosts as host (host.slug)}
					<li class="inline-flex items-center h-12">
						<img
							class="h-10 w-auto max-w-[11rem] object-contain object-left dark:hidden"
							src="{EXTERNAL_SERVICE_LOGOS_BASE}/{host.slug}-dark.svg"
							alt={host.name}
							height="40"
						/>
						<img
							class="hidden h-10 w-auto max-w-[11rem] object-contain object-left dark:block"
							src="{EXTERNAL_SERVICE_LOGOS_BASE}/{host.slug}-light.svg"
							alt=""
							aria-hidden="true"
							height="40"
						/>
					</li>
				{/each}
			</ul>
		</section>

		<section
			id="pricing"
			class="py-14 border-b border-surface-200-800 animate-[rise_0.7s_ease_both]"
		>
			<p
				class="m-0 mb-2 font-mono-status text-[0.75rem] tracking-[0.08em] uppercase text-primary-500"
			>
				Pricing
			</p>
			<h2 class="m-0 text-[clamp(1.5rem,3vw,2rem)] tracking-[-0.03em] max-w-[22ch]">
				Start free. Scale when you need more teams and pages.
			</h2>
			<p class="mt-[0.85rem] max-w-160 text-surface-500 text-[1.05rem]">
				Limits are per billing org. Status page caps apply per team. All prices are CAD per month.
			</p>

			<ul
				class="list-none m-0 mt-9 p-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
			>
				{#each PLAN_LIST as plan (plan.id)}
					<li class="flex flex-col gap-3 border-t border-surface-200-800 pt-5">
						<div>
							<strong class="text-[1.1rem] tracking-[-0.02em]">{plan.name}</strong>
							<p class="m-0 mt-1 font-mono-status text-sm text-primary-500">
								{formatPlanPrice(plan)}
							</p>
							<p class="m-0 mt-2 text-surface-500 text-[0.95rem] leading-[1.45]">
								{plan.tagline}
							</p>
						</div>
						<ul class="list-none m-0 p-0 text-sm text-surface-500 flex flex-col gap-1">
							<li>{plan.maxTeams} team{plan.maxTeams === 1 ? '' : 's'}</li>
							<li>{plan.maxStatusPagesPerTeam} status pages per team</li>
							<li>{plan.maxServicesPerStatusPage} services per page</li>
							{#if plan.sso}
								<li>Custom SSO via SAML or OIDC (coming soon)</li>
							{/if}
						</ul>
						<a class="btn preset-filled-primary-500 self-start mt-auto" href="/signup"
							>{plan.id === 'free' ? 'Get started' : `Choose ${plan.name}`}</a
						>
					</li>
				{/each}
			</ul>
		</section>

		<footer class="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-8 text-surface-500 text-sm">
			<a class="leading-none" href="/" aria-label={BRAND_NAME}>
				<img
					class="h-[1.75rem] w-auto block opacity-90"
					src={BRAND_LOGO_WIDE}
					alt={BRAND_NAME}
					width="180"
					height="36"
				/>
			</a>
			<span class="order-last w-full text-center sm:order-none sm:w-auto"
				>© {year}
				<a
					class="text-surface-500 no-underline hover:text-primary-500"
					href="https://boxingoctop.us"
					target="_blank"
					rel="noopener noreferrer">Boxing Octopus Creative</a
				></span
			>
			<nav class="flex flex-wrap items-center gap-x-6 gap-y-2">
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/terms">Terms</a>
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/privacy"
					>Privacy</a
				>
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/sitemap"
					>Sitemap</a
				>
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/signup">Sign up</a>
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/dashboard/login"
					>Sign in</a
				>
				<a class="text-surface-500 no-underline hover:text-primary-500" href="/api/health">Health</a>
			</nav>
		</footer>
	</div>
</AnimatedGridShell>

<style>
	:global {
		@keyframes rise {
			from {
				opacity: 0;
				transform: translateY(12px);
			}
			to {
				opacity: 1;
				transform: none;
			}
		}

		@keyframes barIn {
			from {
				transform: scaleY(0);
				opacity: 0.3;
			}
			to {
				transform: scaleY(1);
				opacity: 1;
			}
		}
	}

	@media (prefers-reduced-motion: reduce) {
		* {
			animation: none !important;
		}
	}
</style>
