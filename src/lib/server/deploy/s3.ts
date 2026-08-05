import { AwsClient } from 'aws4fetch';
import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { textEncoder } from './types';
import type { AmazonS3HostCreds } from '$lib/server/host-credentials';

function requireCreds(credentials: DeployInput['credentials']): AmazonS3HostCreds {
	const creds = credentials as AmazonS3HostCreds;
	if (
		!creds?.accessKeyId ||
		!creds?.secretAccessKey ||
		!creds?.bucket ||
		!creds?.region ||
		!creds?.publicBaseUrl
	) {
		throw new Error(
			'S3 credentials missing. Add access key, secret, bucket, region, and public base URL under Dashboard → Settings.'
		);
	}
	return {
		accessKeyId: creds.accessKeyId,
		secretAccessKey: creds.secretAccessKey,
		bucket: creds.bucket,
		region: creds.region,
		publicBaseUrl: creds.publicBaseUrl.replace(/\/$/, '')
	};
}

function objectUrl(bucket: string, region: string, key: string): string {
	const encodedKey = key
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
	return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

function joinUrl(base: string, basePath: string): string {
	if (!basePath) return base;
	return `${base}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

export const amazonS3Adapter: DeployAdapter = {
	provider: 'amazon_s3',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const creds = requireCreds(input.credentials);
		const client = new AwsClient({
			accessKeyId: creds.accessKeyId,
			secretAccessKey: creds.secretAccessKey,
			service: 's3',
			region: creds.region
		});

		for (const file of input.files) {
			const key = file.path.replace(/^\//, '');
			if (!key || key.endsWith('/')) continue;
			const body = textEncoder(file.content);
			const res = await client.fetch(objectUrl(creds.bucket, creds.region, key), {
				method: 'PUT',
				headers: {
					'Content-Type': file.contentType ?? 'application/octet-stream'
				},
				body: body.slice()
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(
					`S3 upload failed for ${key} (${res.status}): ${text.slice(0, 400)}`
				);
			}
		}

		return {
			url: joinUrl(creds.publicBaseUrl, input.mode === 'path' ? input.basePath : ''),
			providerId: creds.bucket
		};
	}
};
