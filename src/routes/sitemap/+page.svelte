<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
	import { BRAND_NAME } from '$lib/brand';
</script>

<LegalDoc title="Sitemap" description="Public pages on {BRAND_NAME}." eyebrow="Site">
	<p>Public pages on {BRAND_NAME}.</p>
	<ul>
		<li><a href="/">Home</a></li>
		<li><a href="/signup">Sign up</a></li>
		<li><a href="/dashboard/login">Sign in</a></li>
		<li><a href="/terms">Terms of Use</a></li>
		<li><a href="/privacy">Privacy Policy</a></li>
		<li><a href="/sitemap">Sitemap</a></li>
		<li>
			<a href="/sitemap.xml">XML sitemap</a>
			(for crawlers)
		</li>
		<li><a href="/api/health">Health check</a></li>
	</ul>
	<p>
		Authenticated dashboard routes and customer status pages (<code>/s/[slug]</code> and custom
		domains) are not listed here.
	</p>
</LegalDoc>
