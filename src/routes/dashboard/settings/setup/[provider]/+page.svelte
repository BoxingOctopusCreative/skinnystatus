<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title} setup · Settings</title>
</svelte:head>

<div class="setup-page">
<p class="text-sm text-surface-500 mb-4"><a href="/dashboard/settings">← Settings</a></p>
<h1 class="text-2xl font-bold mb-2">{data.title} setup</h1>
<p class="text-sm text-surface-500 mb-5">
	Create API credentials, then paste them under Dashboard - Settings - {data.title}.
</p>

{#if data.provider === 'vercel'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li><strong>Token</strong> - a Vercel access token with permission to create deployments</li>
			<li><strong>Team ID</strong> (optional) - only if you deploy into a Vercel team instead of your personal account</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create a token</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open
				<a href="https://vercel.com/account/tokens" target="_blank" rel="noopener">vercel.com/account/tokens</a>
				and sign in.
			</li>
			<li>Click <strong>Create</strong>.</li>
			<li>Give the token a name (for example <code>SkinnyStatus</code>).</li>
			<li>Choose the scope: your personal account, or a specific team if you deploy as that team.</li>
			<li>Create the token and <strong>copy it immediately</strong> - Vercel only shows it once.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Find your Team ID (optional)</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open your team settings on Vercel (Team - Settings), or visit
				<a href="https://vercel.com/docs/accounts/create-a-team" target="_blank" rel="noopener"
					>Vercel's team docs</a
				>.
			</li>
			<li>
				The Team ID looks like <code>team_...</code>. You can also find it in the Vercel dashboard URL or
				team settings.
			</li>
			<li>Leave Team ID blank in SkinnyStatus if you are deploying to your personal account.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>Vercel</strong>, paste the token (and Team ID if needed).</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'cloudflare_pages'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li><strong>API token</strong> - a Cloudflare API token that can manage Pages projects</li>
			<li><strong>Account ID</strong> - your Cloudflare account identifier</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Find your Account ID</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Sign in at
				<a href="https://dash.cloudflare.com" target="_blank" rel="noopener">dash.cloudflare.com</a>.
			</li>
			<li>Select any domain or open the account home.</li>
			<li>
				Copy the <strong>Account ID</strong> from the right-hand sidebar (a long hex string).
			</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create an API token</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open
				<a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener"
					>My Profile - API Tokens</a
				>.
			</li>
			<li>Click <strong>Create Token</strong>.</li>
			<li>
				Use <strong>Create Custom Token</strong> (or a template that includes Cloudflare Pages).
			</li>
			<li>
				Grant at least:
				<ul class="mt-1 pl-5">
					<li><strong>Account - Cloudflare Pages - Edit</strong></li>
				</ul>
				Limit the token to the correct account if prompted.
			</li>
			<li>Create the token and <strong>copy it immediately</strong>.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>Cloudflare Pages</strong>, paste the API token and Account ID.</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'netlify'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li><strong>Token</strong> - a Netlify personal access token that can create sites and deploys</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create a personal access token</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open
				<a href="https://app.netlify.com/user/applications#personal-access-tokens" target="_blank" rel="noopener"
					>Netlify - User settings - Applications - Personal access tokens</a
				>.
			</li>
			<li>Click <strong>New access token</strong>.</li>
			<li>Give it a description (for example <code>SkinnyStatus</code>).</li>
			<li>Generate the token and <strong>copy it immediately</strong>.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>Netlify</strong>, paste the token.</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'github_pages'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				<strong>Token</strong> - a GitHub personal access token (classic or fine-grained) that can create
				repositories and push content
			</li>
			<li>
				<strong>Owner</strong> - your GitHub username, or the organization that should own the status
				page repos
			</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create a personal access token</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open
				<a href="https://github.com/settings/tokens" target="_blank" rel="noopener"
					>GitHub - Settings - Developer settings - Personal access tokens</a
				>.
			</li>
			<li>
				Prefer a <strong>classic</strong> token with scopes:
				<ul class="mt-1 pl-5">
					<li><code>repo</code> (full control of private repositories), or at least public repo create/write if you only use public repos</li>
				</ul>
			</li>
			<li>
				For a <strong>fine-grained</strong> token, grant access to the owner account/org and permissions
				to create repositories and write contents.
			</li>
			<li>Generate the token and <strong>copy it immediately</strong>.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Owner value</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Use your GitHub username (for example <code>octocat</code>) for personal repos.</li>
			<li>Use the organization login (for example <code>acme-corp</code>) if SkinnyStatus should create repos under that org.</li>
			<li>Your token must have permission to create repositories for that owner.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>GitHub Pages</strong>, paste the token and owner.</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'static_app'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				<strong>API key</strong> - a static.app API key (starts with <code>sk_</code>) from a paid plan
			</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create an API key</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Sign in at
				<a href="https://static.app" target="_blank" rel="noopener">static.app</a>
				and open Account - API Keys.
			</li>
			<li>Create an API key and <strong>copy it immediately</strong>.</li>
			<li>API access requires a paid static.app plan.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>static.app</strong>, paste the API key.</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'amazon_s3'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li><strong>Access key ID</strong> and <strong>secret access key</strong> for an IAM user that can put objects in your bucket</li>
			<li><strong>Bucket</strong> and <strong>region</strong></li>
			<li>
				<strong>Public base URL</strong> - the HTTPS origin visitors use (CloudFront distribution, custom
				domain, or S3 website endpoint)
			</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Prepare the bucket</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Create an S3 bucket (or reuse one) in the AWS console.</li>
			<li>
				Allow public read via bucket policy (SkinnyStatus does not set object ACLs). Typical policy allows
				<code>s3:GetObject</code> on <code>arn:aws:s3:::your-bucket/*</code>.
			</li>
			<li>
				Point CloudFront or the S3 website endpoint at the bucket, then copy that HTTPS base URL for
				SkinnyStatus.
			</li>
			<li>
				Create an IAM user with <code>s3:PutObject</code> (and usually <code>s3:DeleteObject</code> /
				<code>s3:ListBucket</code>) on that bucket, then create an access key.
			</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>
				Under <strong>Amazon S3</strong>, paste the access key, secret, bucket, region, and public base
				URL.
			</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'firebase_hosting'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li><strong>Site ID</strong> - your Firebase Hosting site id (often the same as the project id)</li>
			<li>
				<strong>Service account JSON</strong> - a Google Cloud service account key with Firebase Hosting
				Admin access
			</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create a service account</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				Open
				<a href="https://console.firebase.google.com" target="_blank" rel="noopener"
					>Firebase console</a
				>
				and select your project. Enable Hosting if needed.
			</li>
			<li>
				In Google Cloud Console - IAM - Service Accounts, create (or pick) a service account and grant
				<strong>Firebase Hosting Admin</strong>.
			</li>
			<li>Create a JSON key and download it. Paste the full JSON into SkinnyStatus.</li>
			<li>
				Confirm the Hosting site id under Hosting - Sites (default site is usually the project id).
			</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>Under <strong>Firebase Hosting</strong>, paste the site ID and service account JSON.</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{:else if data.provider === 'azure_static_web_apps'}
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">What you need</h2>
		<ul class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				<strong>Deployment token</strong> - from an existing Azure Static Web App (Overview - Manage
				deployment token)
			</li>
			<li>
				<strong>Public base URL</strong> - the HTTPS URL of that app (for example
				<code>https://….azurestaticapps.net</code> or your custom domain)
			</li>
		</ul>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Create the Static Web App and token</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>
				In the
				<a href="https://portal.azure.com" target="_blank" rel="noopener">Azure portal</a>, create a
				Static Web App (you can skip GitHub/Azure DevOps linking for manual deploys).
			</li>
			<li>Open the resource - Overview - <strong>Manage deployment token</strong> and copy the token.</li>
			<li>Copy the default hostname (or custom domain) as the public base URL.</li>
		</ol>
	</div>
	<div class="card preset-filled-surface-100-900 p-5 mb-5 border border-surface-200-800">
		<h2 class="text-lg font-semibold mt-0 mb-3">Add credentials in SkinnyStatus</h2>
		<ol class="mt-2 pl-5 leading-relaxed flex flex-col gap-1.5">
			<li>Return to <a href="/dashboard/settings">Settings</a>.</li>
			<li>
				Under <strong>Azure Static Web Apps</strong>, paste the deployment token and public base URL.
			</li>
			<li>Click <strong>Save</strong>.</li>
		</ol>
	</div>
{/if}
</div>

<style>
	.setup-page :global(a) {
		transition: color 0.15s ease;
	}

	.setup-page :global(a:hover) {
		color: var(--color-primary-400);
	}
 </style>
