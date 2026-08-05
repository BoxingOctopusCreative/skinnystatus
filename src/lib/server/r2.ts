import { AwsClient } from 'aws4fetch';
import { getConfig } from '$lib/server/config';

/** Prefix stored in `user.image` when the avatar lives in R2. */
export const R2_IMAGE_PREFIX = 'r2:';

export function isR2Configured(): boolean {
	const r2 = getConfig().r2;
	return Boolean(r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket);
}

function r2Endpoint(): string {
	const r2 = getConfig().r2;
	if (r2.endpoint) return r2.endpoint.replace(/\/$/, '');
	if (!r2.accountId) {
		throw new Error('R2 is not configured (missing account id / endpoint)');
	}
	return `https://${r2.accountId}.r2.cloudflarestorage.com`;
}

function requireR2(): {
	accountId: string;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	endpoint: string | null;
	region: string;
} {
	const r2 = getConfig().r2;
	if (!r2.accountId || !r2.accessKeyId || !r2.secretAccessKey || !r2.bucket) {
		throw new Error(
			'R2 is not configured. Set Infisical /r2 secrets or R2_* env vars (account_id, access_key_id, secret_access_key, bucket).'
		);
	}
	return {
		accountId: r2.accountId,
		accessKeyId: r2.accessKeyId,
		secretAccessKey: r2.secretAccessKey,
		bucket: r2.bucket,
		endpoint: r2.endpoint,
		region: r2.region
	};
}

function awsClient(): AwsClient {
	const r2 = requireR2();
	return new AwsClient({
		accessKeyId: r2.accessKeyId,
		secretAccessKey: r2.secretAccessKey,
		service: 's3',
		region: r2.region || 'auto'
	});
}

function objectUrl(key: string): string {
	const r2 = requireR2();
	const encodedKey = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `${r2Endpoint()}/${r2.bucket}/${encodedKey}`;
}

export type PutObjectInput = {
	key: string;
	body: Uint8Array | ArrayBuffer;
	contentType: string;
};

export async function putObject(input: PutObjectInput): Promise<void> {
	const client = awsClient();
	const bytes =
		input.body instanceof ArrayBuffer
			? new Uint8Array(input.body)
			: new Uint8Array(input.body.buffer, input.body.byteOffset, input.body.byteLength);
	const copy = bytes.slice();
	const res = await client.fetch(objectUrl(input.key), {
		method: 'PUT',
		headers: { 'Content-Type': input.contentType },
		body: copy
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`R2 putObject failed (${res.status}): ${text.slice(0, 400)}`);
	}
}

export async function deleteObject(key: string): Promise<void> {
	const client = awsClient();
	const res = await client.fetch(objectUrl(key), { method: 'DELETE' });
	if (!res.ok && res.status !== 404) {
		const text = await res.text();
		throw new Error(`R2 deleteObject failed (${res.status}): ${text.slice(0, 400)}`);
	}
}

export async function getSignedGetUrl(key: string, expiresSeconds = 3600): Promise<string> {
	const client = awsClient();
	const url = `${objectUrl(key)}?X-Amz-Expires=${expiresSeconds}`;
	const signed = await client.sign(new Request(url, { method: 'GET' }), {
		aws: { signQuery: true }
	});
	return signed.url.toString();
}

export function avatarObjectKey(userId: string, ext: string): string {
	const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'bin';
	return `avatars/${userId}.${cleanExt}`;
}

export function teamBannerObjectKey(teamId: string, ext: string): string {
	const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'bin';
	return `team-banners/${teamId}.${cleanExt}`;
}

export type ImageRef =
	| { kind: 'r2'; value: string }
	| { kind: 'url'; value: string }
	| { kind: 'none'; value: string };

export function parseImageRef(image: string | null): ImageRef {
	if (!image) return { kind: 'none', value: '' };
	if (image.startsWith(R2_IMAGE_PREFIX)) {
		return { kind: 'r2', value: image.slice(R2_IMAGE_PREFIX.length) };
	}
	if (/^https?:\/\//i.test(image)) {
		return { kind: 'url', value: image };
	}
	return { kind: 'none', value: image };
}

export async function resolveImageUrl(image: string | null): Promise<string | null> {
	const ref = parseImageRef(image);
	if (ref.kind === 'r2') {
		if (!isR2Configured() || !ref.value) return null;
		return getSignedGetUrl(ref.value);
	}
	if (ref.kind === 'url') return ref.value;
	return null;
}

function extensionFromContentType(contentType: string): string | null {
	const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
	switch (base) {
		case 'image/jpeg':
		case 'image/jpg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/gif':
			return 'gif';
		case 'image/webp':
			return 'webp';
		case 'image/svg+xml':
			return 'svg';
		default:
			return null;
	}
}

function extensionFromUrl(url: string): string | null {
	try {
		const pathname = new URL(url).pathname;
		const match = pathname.match(/\.([a-z0-9]{1,8})$/i);
		return match?.[1]?.toLowerCase() ?? null;
	} catch {
		return null;
	}
}

/**
 * Download an image URL and store it in R2. Returns `r2:key` on success, or null on failure.
 */
export async function uploadAvatarFromUrl(userId: string, url: string): Promise<string | null> {
	if (!isR2Configured()) return null;

	try {
		const res = await fetch(url);
		if (!res.ok) return null;

		const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';
		const ext =
			extensionFromContentType(contentType) ?? extensionFromUrl(url) ?? 'bin';
		const key = avatarObjectKey(userId, ext);
		const body = new Uint8Array(await res.arrayBuffer());
		await putObject({ key, body, contentType });
		return `${R2_IMAGE_PREFIX}${key}`;
	} catch {
		return null;
	}
}
