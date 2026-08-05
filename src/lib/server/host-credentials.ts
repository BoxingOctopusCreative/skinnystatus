import { and, eq } from 'drizzle-orm';
import { decryptJson, encryptJson } from '$lib/server/crypto';
import { db, teamHostCredential } from '$lib/server/db';
import type { HostProvider } from '$lib/publishing';
import { HOST_PROVIDERS, isHostProvider } from '$lib/publishing';

export type VercelHostCreds = { token: string; teamId?: string | null };
export type CloudflareHostCreds = { apiToken: string; accountId: string };
export type NetlifyHostCreds = { token: string };
export type GitHubHostCreds = { token: string; owner: string };
export type StaticAppHostCreds = { apiKey: string };
export type AmazonS3HostCreds = {
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	region: string;
	publicBaseUrl: string;
};
export type FirebaseHostCreds = { siteId: string; serviceAccountJson: string };
export type AzureSwaHostCreds = { deploymentToken: string; publicBaseUrl: string };

export type HostCredsByProvider = {
	vercel: VercelHostCreds;
	cloudflare_pages: CloudflareHostCreds;
	netlify: NetlifyHostCreds;
	github_pages: GitHubHostCreds;
	static_app: StaticAppHostCreds;
	amazon_s3: AmazonS3HostCreds;
	firebase_hosting: FirebaseHostCreds;
	azure_static_web_apps: AzureSwaHostCreds;
};

export type HostCredentials = HostCredsByProvider[HostProvider];

export function listConfiguredProviders(teamId: string): Promise<HostProvider[]> {
	return db
		.select({ provider: teamHostCredential.provider })
		.from(teamHostCredential)
		.where(eq(teamHostCredential.teamId, teamId))
		.then((rows: { provider: string }[]) =>
			rows.map((r) => r.provider).filter((p): p is HostProvider => isHostProvider(p))
		);
}

export async function providerReadyMap(
	teamId: string
): Promise<Record<HostProvider, boolean>> {
	const configured = new Set(await listConfiguredProviders(teamId));
	return Object.fromEntries(
		HOST_PROVIDERS.map((p) => [p, configured.has(p)])
	) as Record<HostProvider, boolean>;
}

export async function getHostCredentials<P extends HostProvider>(
	teamId: string,
	provider: P
): Promise<HostCredsByProvider[P] | null> {
	const rows = await db
		.select()
		.from(teamHostCredential)
		.where(
			and(eq(teamHostCredential.teamId, teamId), eq(teamHostCredential.provider, provider))
		)
		.limit(1);

	const row = rows[0];
	if (!row) return null;
	return decryptJson<HostCredsByProvider[P]>(row.ciphertext);
}

export async function upsertHostCredentials<P extends HostProvider>(
	teamId: string,
	provider: P,
	creds: HostCredsByProvider[P]
): Promise<void> {
	const ciphertext = encryptJson(creds);
	const existing = await db
		.select({ id: teamHostCredential.id })
		.from(teamHostCredential)
		.where(
			and(eq(teamHostCredential.teamId, teamId), eq(teamHostCredential.provider, provider))
		)
		.limit(1);

	if (existing[0]) {
		await db
			.update(teamHostCredential)
			.set({ ciphertext, updatedAt: new Date() })
			.where(eq(teamHostCredential.id, existing[0].id));
		return;
	}

	await db.insert(teamHostCredential).values({
		teamId,
		provider,
		ciphertext
	});
}

export async function deleteHostCredentials(
	teamId: string,
	provider: HostProvider
): Promise<void> {
	await db
		.delete(teamHostCredential)
		.where(
			and(eq(teamHostCredential.teamId, teamId), eq(teamHostCredential.provider, provider))
		);
}

export async function requireHostCredentials<P extends HostProvider>(
	teamId: string,
	provider: P
): Promise<HostCredsByProvider[P]> {
	const creds = await getHostCredentials(teamId, provider);
	if (!creds) {
		throw new Error(
			`Host credentials for ${provider} are not configured. Add them under Dashboard → Settings.`
		);
	}
	return creds;
}
