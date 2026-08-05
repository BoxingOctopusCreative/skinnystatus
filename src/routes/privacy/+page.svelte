<script lang="ts">
	import LegalDoc from '$lib/components/LegalDoc.svelte';
	import { BRAND_NAME } from '$lib/brand';
</script>

<LegalDoc
	title="Privacy Policy"
	description="Privacy Policy for {BRAND_NAME}, operated by Boxing Octopus Creative."
	updated="July 21, 2026"
>
	<p>
		This Privacy Policy explains how Boxing Octopus Creative ("we", "us", or "our"), a company based
		in Ontario, Canada, collects, uses, and discloses personal information when you use
		{BRAND_NAME} at
		<a href="https://skinnystatus.app">skinnystatus.app</a> and related services (the "Service").
	</p>

	<h2>1. Who we are</h2>
	<p>
		{BRAND_NAME} is operated by Boxing Octopus Creative, based in Ontario, Canada. We handle
		personal information in accordance with the Personal Information Protection and Electronic
		Documents Act (PIPEDA) and other applicable Canadian privacy law. For contact details, see
		<a href="https://boxingoctop.us" rel="noopener noreferrer">boxingoctop.us</a>.
	</p>

	<h2>2. Information we collect</h2>
	<p>Depending on how you use the Service, we may process:</p>
	<ul>
		<li>
			<strong>Account data:</strong> name, email address, and password hash, or OAuth identifiers
			from providers such as GitHub or Google when you sign in that way
		</li>
		<li><strong>Team and organization data:</strong> team names, membership, and invitations</li>
		<li>
			<strong>Status page and monitoring data:</strong> page content, services, check
			configurations (such as URLs and hosts), and incidents
		</li>
		<li>
			<strong>Host credentials:</strong> credentials you provide for publishing status pages
			(stored encrypted at rest)
		</li>
		<li>
			<strong>Subscriber emails:</strong> addresses end users submit on public status pages to
			receive notifications
		</li>
		<li>
			<strong>Operational data:</strong> logs and error monitoring information (including via Sentry
			when configured)
		</li>
		<li>
			<strong>Bot protection signals:</strong> Cloudflare Turnstile responses when that feature is
			configured on forms
		</li>
		<li>
			<strong>Cookies and session data:</strong> used for authentication and keeping you signed in
		</li>
		<li>
			<strong>Local preferences:</strong> theme preference may be stored in your browser
		</li>
	</ul>

	<h2>3. How we use information</h2>
	<p>We use information to:</p>
	<ul>
		<li>Provide, operate, and improve the Service</li>
		<li>Authenticate users and manage teams and invitations</li>
		<li>Run checks, render status pages, and publish to hosts you configure</li>
		<li>Send transactional and status-related email (including via Mailgun when configured)</li>
		<li>Protect against abuse and bots</li>
		<li>Monitor reliability and diagnose errors</li>
		<li>Communicate about the Service, security, and material policy changes</li>
	</ul>

	<h2>4. Consent and purposes</h2>
	<p>
		Under PIPEDA, we collect, use, and disclose personal information for purposes a reasonable
		person would consider appropriate in the circumstances, and with your knowledge and consent
		except where the law permits or requires otherwise. By creating an account, using the Service,
		or submitting information (such as a subscription email on a status page), you consent to the
		practices described in this Policy for the purposes listed above.
	</p>
	<p>
		You may withdraw consent for optional uses, subject to legal or contractual restrictions and
		reasonable notice. Withdrawal may limit our ability to provide some features. Where another
		region's privacy laws also apply to you, we will respect those requirements as well.
	</p>

	<h2>5. Sharing with service providers</h2>
	<p>
		We may disclose personal information to service providers that help us run {BRAND_NAME}, which
		may include Mailgun, Cloudflare (including Turnstile), OAuth providers, hosting and storage
		providers, and Sentry. These parties are expected to use the information only to provide
		services to us (or as otherwise required by law). We do not sell personal information.
	</p>

	<h2>6. Data retention</h2>
	<p>
		We retain account, team, and status-related data while your account is active and as needed to
		operate the Service. We may retain limited records after deletion or closure for security,
		dispute resolution, backups, and legal compliance, for as long as reasonably necessary.
		Subscriber emails are retained in connection with the status pages they subscribed to until they
		unsubscribe or the relevant data is removed.
	</p>

	<h2>7. Security</h2>
	<p>
		We use reasonable technical and organizational measures to protect information, including
		encryption for sensitive host credentials at rest and access controls on our systems. No method
		of transmission or storage is completely secure. You are responsible for protecting your account
		credentials.
	</p>

	<h2>8. Your rights</h2>
	<p>
		Under PIPEDA and other applicable Canadian privacy law, you may have the right to access personal
		information we hold about you, to challenge its accuracy and completeness, and to request
		correction. You can often update or delete account information through account settings. Status
		page subscribers can unsubscribe via the links in notification emails or related unsubscribe
		flows. To make an access, correction, or other privacy request, contact us through
		<a href="https://boxingoctop.us" rel="noopener noreferrer">boxingoctop.us</a>. We may need to
		verify your identity before responding, and we will respond within the timeframes required by
		applicable law.
	</p>
	<p>
		If you are not satisfied with our response, you may contact the Office of the Privacy
		Commissioner of Canada.
	</p>

	<h2>9. Cross-border transfers</h2>
	<p>
		Personal information may be processed and stored outside Canada, including by service providers
		in other countries, where privacy laws may differ. When we transfer personal information
		outside Canada, we take steps we consider appropriate in the circumstances (such as contractual
		and organizational measures) so that the information receives a comparable level of protection
		while it is being processed. By using the Service, you acknowledge that your information may be
		subject to the laws of those other jurisdictions, including lawful access by foreign
		authorities.
	</p>

	<h2>10. Children's privacy</h2>
	<p>
		The Service is not directed at children under 13, and we do not knowingly collect personal
		information from children under 13 without appropriate consent as required by law. If you
		believe a child has provided us information improperly, contact us and we will take appropriate
		steps to delete it.
	</p>

	<h2>11. Changes</h2>
	<p>
		We may update this Privacy Policy from time to time. We will post the updated policy with a
		revised "Last updated" date. Material changes may also be communicated through the Service or by
		email when practical.
	</p>

	<h2>12. Contact</h2>
	<p>
		Privacy questions: visit
		<a href="https://boxingoctop.us" rel="noopener noreferrer">boxingoctop.us</a>.
	</p>
</LegalDoc>
