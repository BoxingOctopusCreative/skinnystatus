import { AwsClient } from 'aws4fetch';
import type { HostProvider } from '$lib/publishing';
import type { HostCredsByProvider } from '$lib/server/host-credentials';

async function expectOk(res: Response, label: string): Promise<void> {
	if (res.ok) return;
	const text = await res.text();
	throw new Error(`${label} failed (${res.status}): ${text.slice(0, 300)}`);
}

async function testVercel(creds: HostCredsByProvider['vercel']): Promise<string> {
	const teamQuery = creds.teamId ? `?teamId=${encodeURIComponent(creds.teamId)}` : '';
	const res = await fetch(`https://api.vercel.com/v9/projects${teamQuery}&limit=1`.replace('?&', '?'), {
		headers: { Authorization: `Bearer ${creds.token}` }
	});
	await expectOk(res, 'Vercel API check');
	return creds.teamId ? 'Connected to Vercel team scope.' : 'Connected to Vercel personal scope.';
}

async function testCloudflare(creds: HostCredsByProvider['cloudflare_pages']): Promise<string> {
	const res = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/pages/projects?per_page=1`,
		{ headers: { Authorization: `Bearer ${creds.apiToken}` } }
	);
	await expectOk(res, 'Cloudflare Pages API check');
	return 'Connected to Cloudflare Pages.';
}

async function testNetlify(creds: HostCredsByProvider['netlify']): Promise<string> {
	const res = await fetch('https://api.netlify.com/api/v1/sites?per_page=1', {
		headers: { Authorization: `Bearer ${creds.token}` }
	});
	await expectOk(res, 'Netlify API check');
	return 'Connected to Netlify.';
}

async function testGitHub(creds: HostCredsByProvider['github_pages']): Promise<string> {
	const headers = {
		Authorization: `Bearer ${creds.token}`,
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'SkinnyStatus'
	};
	const viewer = await fetch('https://api.github.com/user', { headers });
	await expectOk(viewer, 'GitHub token check');
	const owner = await fetch(`https://api.github.com/users/${encodeURIComponent(creds.owner)}`, { headers });
	await expectOk(owner, 'GitHub owner lookup');
	return `Connected to GitHub. Owner "${creds.owner}" is reachable.`;
}

async function testStaticApp(creds: HostCredsByProvider['static_app']): Promise<string> {
	const res = await fetch('https://api.static.app/v1/sites', {
		headers: { Authorization: `Bearer ${creds.apiKey}` }
	});
	await expectOk(res, 'static.app API check');
	return 'Connected to static.app.';
}

async function testS3(creds: HostCredsByProvider['amazon_s3']): Promise<string> {
	const client = new AwsClient({
		accessKeyId: creds.accessKeyId,
		secretAccessKey: creds.secretAccessKey,
		service: 's3',
		region: creds.region
	});
	const res = await client.fetch(`https://${creds.bucket}.s3.${creds.region}.amazonaws.com/`, {
		method: 'HEAD'
	});
	await expectOk(res, 'Amazon S3 bucket check');
	return `Connected to Amazon S3 bucket "${creds.bucket}".`;
}

type FirebaseServiceAccount = {
	client_email: string;
	private_key: string;
	token_uri?: string;
};

function b64url(input: string | Buffer): string {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

async function googleAccessToken(sa: FirebaseServiceAccount): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claim = b64url(
		JSON.stringify({
			iss: sa.client_email,
			scope: 'https://www.googleapis.com/auth/firebase.hosting.readonly',
			aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const unsigned = `${header}.${claim}`;
	const { createSign } = await import('node:crypto');
	const signer = createSign('RSA-SHA256');
	signer.update(unsigned);
	const signature = signer.sign(sa.private_key, 'base64');
	const jwt = `${unsigned}.${signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

	const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
	const res = await fetch(tokenUri, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	});
	await expectOk(res, 'Firebase auth');
	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error('Firebase auth returned no access token');
	return data.access_token;
}

async function testFirebase(creds: HostCredsByProvider['firebase_hosting']): Promise<string> {
	const sa = JSON.parse(creds.serviceAccountJson) as FirebaseServiceAccount;
	const token = await googleAccessToken(sa);
	const res = await fetch(
		`https://firebasehosting.googleapis.com/v1beta1/sites/${encodeURIComponent(creds.siteId)}`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);
	await expectOk(res, 'Firebase Hosting API check');
	return `Connected to Firebase Hosting site "${creds.siteId}".`;
}

async function testAzureStaticWebApps(
	creds: HostCredsByProvider['azure_static_web_apps']
): Promise<string> {
	const res = await fetch(creds.publicBaseUrl, { method: 'HEAD' });
	await expectOk(res, 'Azure Static Web Apps URL check');
	return 'Azure Static Web App is reachable at the configured public URL.';
}

export async function testHostConnectivity<P extends HostProvider>(
	provider: P,
	creds: HostCredsByProvider[P]
): Promise<string> {
	switch (provider) {
		case 'vercel':
			return testVercel(creds as HostCredsByProvider['vercel']);
		case 'cloudflare_pages':
			return testCloudflare(creds as HostCredsByProvider['cloudflare_pages']);
		case 'netlify':
			return testNetlify(creds as HostCredsByProvider['netlify']);
		case 'github_pages':
			return testGitHub(creds as HostCredsByProvider['github_pages']);
		case 'static_app':
			return testStaticApp(creds as HostCredsByProvider['static_app']);
		case 'amazon_s3':
			return testS3(creds as HostCredsByProvider['amazon_s3']);
		case 'firebase_hosting':
			return testFirebase(creds as HostCredsByProvider['firebase_hosting']);
		case 'azure_static_web_apps':
			return testAzureStaticWebApps(creds as HostCredsByProvider['azure_static_web_apps']);
	}
}
