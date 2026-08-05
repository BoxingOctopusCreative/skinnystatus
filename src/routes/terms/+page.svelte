<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
	import { BRAND_NAME } from '$lib/brand';
</script>

<LegalDoc
	title="Terms of Use"
	description="Terms of Use for {BRAND_NAME}, operated by Boxing Octopus Creative."
	updated="July 21, 2026"
>
	<p>
		These Terms of Use ("Terms") govern your access to and use of {BRAND_NAME} at
		<a href="https://skinnystatus.app">skinnystatus.app</a> and related services (the "Service").
		The Service is operated by Boxing Octopus Creative ("we", "us", or "our"), a company based in
		Ontario, Canada. By creating an account or using the Service, you agree to these Terms.
	</p>

	<h2>1. Agreement to terms</h2>
	<p>
		If you do not agree to these Terms, do not use the Service. If you use the Service on behalf of
		an organization, you represent that you have authority to bind that organization, and "you"
		includes that organization.
	</p>

	<h2>2. Description of service</h2>
	<p>
		{BRAND_NAME} is a status monitoring and publishing platform. Depending on your configuration,
		the Service may include:
	</p>
	<ul>
		<li>Uptime and health checks against endpoints you configure</li>
		<li>Status pages that display service and overall status</li>
		<li>
			Publishing status pages to hosts you connect (for example Cloudflare, Vercel, Netlify, S3,
			and similar providers)
		</li>
		<li>Incident creation and updates on status pages</li>
		<li>Email subscription notifications for status page subscribers</li>
	</ul>
	<p>
		Features may change over time. We may add, modify, or discontinue capabilities with reasonable
		notice when practical.
	</p>

	<h2>3. Accounts and eligibility</h2>
	<p>
		You must provide accurate account information and keep it up to date. You are responsible for
		activity under your credentials and for safeguarding passwords and OAuth-linked accounts. When
		enabled, you may sign in with third-party OAuth providers such as GitHub or Google. You must be
		able to form a binding contract under applicable law to use the Service.
	</p>

	<h2>4. Acceptable use</h2>
	<p>You agree not to:</p>
	<ul>
		<li>Abuse monitoring features (for example, excessive or hostile probing of third-party systems)</li>
		<li>Publish illegal, infringing, or harmful content on status pages</li>
		<li>Interfere with, disrupt, or attempt unauthorized access to the Service or related systems</li>
		<li>Scrape or automate access in ways that degrade or harm the Service</li>
		<li>Misrepresent affiliation with {BRAND_NAME} or Boxing Octopus Creative</li>
	</ul>

	<h2>5. Customer content and status pages</h2>
	<p>
		You retain ownership of content you submit to the Service, including status page copy, service
		definitions, check configurations, and incident updates ("Customer Content"). You grant us a
		worldwide, non-exclusive license to host, process, display, and publish Customer Content as
		needed to operate and provide the Service, including publishing to hosts you configure.
	</p>
	<p>
		You are responsible for Customer Content and for ensuring you have rights to use and publish it.
		Public status pages and published sites may be visible to anyone with the URL or domain you
		configure.
	</p>

	<h2>6. Third-party services</h2>
	<p>
		The Service may integrate with third parties, including OAuth providers, Mailgun (email),
		Cloudflare Turnstile (bot protection), deploy hosts you connect, object storage (such as R2),
		and error monitoring (such as Sentry when configured). Your use of those services is subject to
		their own terms and policies. We are not responsible for third-party services or their
		availability.
	</p>

	<h2>7. Service availability</h2>
	<p>
		We strive to keep {BRAND_NAME} available and useful, but the Service is provided on a best-effort
		basis. Monitoring results and status displays are informational tools. They are not a guarantee
		of uptime, correctness, or availability of your own systems or third-party services you monitor.
	</p>

	<h2>8. Fees</h2>
	<p>
		{BRAND_NAME} may currently be offered free of charge or in a beta capacity. We may introduce or
		change pricing with notice. Continued use after fee changes take effect constitutes acceptance of
		the updated pricing, unless you stop using the Service before then.
	</p>

	<h2>9. Suspension and termination</h2>
	<p>
		You may stop using the Service at any time. We may suspend or terminate access if you violate
		these Terms, if required by law, or if continued use poses risk to the Service or others. Upon
		termination, your right to use the Service ends. Provisions that by nature should survive
		(including ownership, disclaimers, limitation of liability, and indemnification) will survive.
	</p>

	<h2>10. Disclaimers and limitation of liability</h2>
	<p>
		THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER
		EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
		NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
	</p>
	<p>
		TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, BOXING OCTOPUS CREATIVE AND ITS AFFILIATES
		WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE
		DAMAGES, OR FOR LOST PROFITS, REVENUE, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE.
		OUR TOTAL LIABILITY FOR CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF THE
		AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM OR ONE HUNDRED
		CANADIAN DOLLARS (CAD $100). NOTHING IN THESE TERMS EXCLUDES OR LIMITS LIABILITY THAT CANNOT BE
		EXCLUDED OR LIMITED UNDER APPLICABLE CANADIAN LAW.
	</p>

	<h2>11. Indemnification</h2>
	<p>
		You will defend and indemnify Boxing Octopus Creative and its personnel against claims, damages,
		and expenses arising from your Customer Content, your use of the Service, or your violation of
		these Terms or applicable law.
	</p>

	<h2>12. Changes to terms</h2>
	<p>
		We may update these Terms from time to time. We will post the updated Terms with a revised "Last
		updated" date. Material changes may also be communicated through the Service or by email when
		practical. Continued use after changes become effective constitutes acceptance of the updated
		Terms.
	</p>

	<h2>13. Governing law</h2>
	<p>
		These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada
		applicable therein, without regard to conflict-of-law principles that would require another
		jurisdiction's laws. Subject to applicable consumer-protection rights that cannot be waived, you
		agree that the courts of Ontario (and the federal courts sitting in Ontario) have exclusive
		jurisdiction over disputes arising from these Terms or the Service.
	</p>

	<h2>14. Contact</h2>
	<p>
		Questions about these Terms: visit
		<a href="https://boxingoctop.us" rel="noopener noreferrer">boxingoctop.us</a>.
	</p>
</LegalDoc>
