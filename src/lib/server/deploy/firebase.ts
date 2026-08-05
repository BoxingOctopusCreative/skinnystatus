import { createHash, createSign, randomUUID } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { textEncoder } from './types';
import type { FirebaseHostCreds } from '$lib/server/host-credentials';

type ServiceAccount = {
	client_email: string;
	private_key: string;
	token_uri?: string;
};

function requireCreds(credentials: DeployInput['credentials']): {
	siteId: string;
	sa: ServiceAccount;
} {
	const creds = credentials as FirebaseHostCreds;
	if (!creds?.siteId || !creds?.serviceAccountJson) {
		throw new Error(
			'Firebase credentials missing. Add a site ID and service account JSON under Dashboard → Settings.'
		);
	}
	let sa: ServiceAccount;
	try {
		sa = JSON.parse(creds.serviceAccountJson) as ServiceAccount;
	} catch {
		throw new Error('Firebase service account JSON is invalid');
	}
	if (!sa.client_email || !sa.private_key) {
		throw new Error('Firebase service account JSON must include client_email and private_key');
	}
	return { siteId: creds.siteId.trim(), sa };
}

function b64url(input: string | Buffer): string {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claim = b64url(
		JSON.stringify({
			iss: sa.client_email,
			scope: 'https://www.googleapis.com/auth/firebase.hosting',
			aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const unsigned = `${header}.${claim}`;
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
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Firebase auth failed (${res.status}): ${text.slice(0, 400)}`);
	}
	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error('Firebase auth returned no access token');
	return data.access_token;
}

function gzipHash(content: Uint8Array): { gzipped: Uint8Array; hash: string } {
	const gzipped = gzipSync(content);
	const hash = createHash('sha256').update(gzipped).digest('hex');
	return { gzipped, hash };
}

function joinUrl(base: string, basePath: string): string {
	const root = base.replace(/\/$/, '');
	if (!basePath) return root;
	return `${root}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

export const firebaseHostingAdapter: DeployAdapter = {
	provider: 'firebase_hosting',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { siteId, sa } = requireCreds(input.credentials);
		const token = await googleAccessToken(sa);
		const authHeaders = {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		};

		const createRes = await fetch(
			`https://firebasehosting.googleapis.com/v1beta1/sites/${encodeURIComponent(siteId)}/versions`,
			{
				method: 'POST',
				headers: authHeaders,
				body: JSON.stringify(
					input.mode === 'subdomain'
						? {
								config: {
									rewrites: [{ glob: '**', path: '/index.html' }]
								}
							}
						: {}
				)
			}
		);
		if (!createRes.ok) {
			const text = await createRes.text();
			throw new Error(
				`Firebase create version failed (${createRes.status}): ${text.slice(0, 400)}`
			);
		}
		const version = (await createRes.json()) as { name?: string };
		if (!version.name) throw new Error('Firebase create version returned no name');

		const filesMap: Record<string, string> = {};
		const byHash = new Map<string, Uint8Array>();
		for (const file of input.files) {
			const path = `/${file.path.replace(/^\//, '')}`;
			if (path.endsWith('/')) continue;
			const { gzipped, hash } = gzipHash(textEncoder(file.content));
			filesMap[path] = hash;
			byHash.set(hash, gzipped);
		}

		const populateRes = await fetch(
			`https://firebasehosting.googleapis.com/v1beta1/${version.name}:populateFiles`,
			{
				method: 'POST',
				headers: authHeaders,
				body: JSON.stringify({ files: filesMap })
			}
		);
		if (!populateRes.ok) {
			const text = await populateRes.text();
			throw new Error(
				`Firebase populateFiles failed (${populateRes.status}): ${text.slice(0, 400)}`
			);
		}
		const populated = (await populateRes.json()) as {
			uploadUrl?: string;
			uploadRequiredHashes?: string[];
		};
		const uploadUrl = populated.uploadUrl;
		const required = populated.uploadRequiredHashes ?? [];
		if (!uploadUrl && required.length > 0) {
			throw new Error('Firebase populateFiles returned required hashes but no uploadUrl');
		}

		for (const hash of required) {
			const body = byHash.get(hash);
			if (!body) {
				throw new Error(`Firebase requested unknown file hash ${hash}`);
			}
			const uploadRes = await fetch(`${uploadUrl}/${hash}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/octet-stream'
				},
				body: Buffer.from(body)
			});
			if (!uploadRes.ok) {
				const text = await uploadRes.text();
				throw new Error(
					`Firebase file upload failed (${uploadRes.status}): ${text.slice(0, 400)}`
				);
			}
		}

		const finalizeRes = await fetch(
			`https://firebasehosting.googleapis.com/v1beta1/${version.name}?update_mask=status`,
			{
				method: 'PATCH',
				headers: authHeaders,
				body: JSON.stringify({ status: 'FINALIZED' })
			}
		);
		if (!finalizeRes.ok) {
			const text = await finalizeRes.text();
			throw new Error(
				`Firebase finalize version failed (${finalizeRes.status}): ${text.slice(0, 400)}`
			);
		}

		const releaseRes = await fetch(
			`https://firebasehosting.googleapis.com/v1beta1/sites/${encodeURIComponent(siteId)}/releases?versionName=${encodeURIComponent(version.name)}`,
			{
				method: 'POST',
				headers: authHeaders,
				body: JSON.stringify({
					message: `SkinnyStatus deploy ${randomUUID().slice(0, 8)}`
				})
			}
		);
		if (!releaseRes.ok) {
			const text = await releaseRes.text();
			throw new Error(
				`Firebase release failed (${releaseRes.status}): ${text.slice(0, 400)}`
			);
		}

		return {
			url: joinUrl(
				`https://${siteId}.web.app`,
				input.mode === 'path' ? input.basePath : ''
			),
			providerId: siteId
		};
	}
};
