import { createHash } from 'node:crypto';
import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, platform as osPlatform, tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import type { DeployAdapter, DeployInput, DeployResult } from './types';
import type { AzureSwaHostCreds } from '$lib/server/host-credentials';
import { stageFiles } from './staging';

const METADATA_URL = 'https://aka.ms/swalocaldeploy';
const CACHE_DIR = resolve(homedir(), '.skinnystatus', 'swa-deploy');
const ALLOWED_DOWNLOAD_HOST_SUFFIXES = ['.azurefd.net', '.azureedge.net', '.microsoft.com'];

type PlatformKey = 'win-x64' | 'osx-x64' | 'linux-x64';

type ReleaseMetadata = {
	version: string;
	buildId: string;
	files: Record<PlatformKey, { url: string; sha: string }>;
};

function requireCreds(credentials: DeployInput['credentials']): AzureSwaHostCreds {
	const creds = credentials as AzureSwaHostCreds;
	if (!creds?.deploymentToken || !creds?.publicBaseUrl) {
		throw new Error(
			'Azure Static Web Apps credentials missing. Add a deployment token and public base URL under Dashboard → Settings.'
		);
	}
	return {
		deploymentToken: creds.deploymentToken,
		publicBaseUrl: creds.publicBaseUrl.replace(/\/$/, '')
	};
}

function platformKey(): PlatformKey {
	switch (osPlatform()) {
		case 'win32':
			return 'win-x64';
		case 'darwin':
			return 'osx-x64';
		default:
			return 'linux-x64';
	}
}

function joinUrl(base: string, basePath: string): string {
	if (!basePath) return base;
	return `${base}${basePath.startsWith('/') ? basePath : `/${basePath}`}`;
}

function assertSafeBuildId(buildId: string): string {
	if (!/^[a-f0-9]{8,64}$/i.test(buildId)) {
		throw new Error('Azure Static Sites Client metadata returned an invalid build id');
	}
	return buildId;
}

function assertSafeSha(sha: string): string {
	if (!/^[a-f0-9]{64}$/i.test(sha)) {
		throw new Error('Azure Static Sites Client metadata returned an invalid checksum');
	}
	return sha;
}

function assertAllowedDownloadUrl(urlString: string): URL {
	let url: URL;
	try {
		url = new URL(urlString);
	} catch {
		throw new Error('Azure Static Sites Client metadata returned an invalid download URL');
	}
	if (url.protocol !== 'https:') {
		throw new Error('Azure Static Sites Client download URL must use HTTPS');
	}
	const host = url.hostname.toLowerCase();
	const allowed = ALLOWED_DOWNLOAD_HOST_SUFFIXES.some(
		(suffix) => host === suffix.slice(1) || host.endsWith(suffix)
	);
	if (!allowed) {
		throw new Error(`Azure Static Sites Client download host is not allowed: ${host}`);
	}
	return url;
}

function binaryFilename(plat: PlatformKey): string {
	return plat === 'win-x64' ? 'StaticSitesClient.exe' : 'StaticSitesClient';
}

function assertUnderCache(path: string): string {
	const resolved = resolve(path);
	const root = CACHE_DIR.endsWith(sep) ? CACHE_DIR : CACHE_DIR + sep;
	if (resolved !== CACHE_DIR && !resolved.startsWith(root)) {
		throw new Error('Refusing to use Azure Static Sites Client path outside cache');
	}
	return resolved;
}

async function resolveStaticSitesClient(): Promise<string> {
	const plat = platformKey();
	const metaRes = await fetch(METADATA_URL);
	if (!metaRes.ok) {
		throw new Error(`Could not fetch Azure Static Sites Client metadata (${metaRes.status})`);
	}
	const releases = (await metaRes.json()) as ReleaseMetadata[];
	const release = releases.find((r) => r.version === 'stable') ?? releases[0];
	if (!release?.files?.[plat]) {
		throw new Error(`Azure Static Sites Client has no binary for platform ${plat}`);
	}

	const fileMeta = release.files[plat];
	const buildId = assertSafeBuildId(release.buildId);
	const expectedSha = assertSafeSha(fileMeta.sha);
	assertAllowedDownloadUrl(fileMeta.url);

	const dir = assertUnderCache(join(CACHE_DIR, buildId));
	const binaryPath = assertUnderCache(join(dir, binaryFilename(plat)));

	if (existsSync(binaryPath)) {
		const hash = createHash('sha256').update(readFileSync(binaryPath)).digest('hex');
		if (hash.toLowerCase() === expectedSha.toLowerCase()) {
			return binaryPath;
		}
	}

	mkdirSync(dir, { recursive: true });
	const dl = await fetch(fileMeta.url);
	if (!dl.ok || !dl.body) {
		throw new Error(`Failed to download Azure Static Sites Client (${dl.status})`);
	}
	const nodeStream = Readable.fromWeb(dl.body as import('node:stream/web').ReadableStream);
	await pipeline(nodeStream, createWriteStream(binaryPath));
	if (plat !== 'win-x64') {
		chmodSync(binaryPath, 0o755);
	}
	const hash = createHash('sha256').update(readFileSync(binaryPath)).digest('hex');
	if (hash.toLowerCase() !== expectedSha.toLowerCase()) {
		throw new Error('Azure Static Sites Client checksum mismatch');
	}
	return binaryPath;
}

function ensureSwaConfig(dir: string): void {
	const configPath = join(dir, 'staticwebapp.config.json');
	if (existsSync(configPath)) return;
	writeFileSync(
		configPath,
		JSON.stringify(
			{
				navigationFallback: {
					rewrite: '/index.html',
					exclude: ['/assets/*', '/*.css', '/*.js', '/*.svg', '/*.ico']
				}
			},
			null,
			2
		)
	);
}

function runStaticSitesClient(binary: string, env: Record<string, string>): Promise<void> {
	const safeBinary = assertUnderCache(binary);
	return new Promise((resolvePromise, reject) => {
		const child = spawn(safeBinary, [], {
			env: { ...process.env, ...env },
			cwd: tmpdir(),
			shell: false
		});
		let stderr = '';
		let stdout = '';
		child.stdout?.on('data', (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolvePromise();
				return;
			}
			const detail = (stderr || stdout).trim().slice(0, 600);
			reject(
				new Error(
					`Azure Static Web Apps deploy failed (exit ${code})${detail ? `: ${detail}` : ''}`
				)
			);
		});
	});
}

const SWA_CONFIG = JSON.stringify(
	{
		navigationFallback: {
			rewrite: '/index.html',
			exclude: ['/assets/*', '/*.css', '/*.js', '/*.svg', '/*.ico']
		}
	},
	null,
	2
);

export const azureSwaAdapter: DeployAdapter = {
	provider: 'azure_static_web_apps',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const creds = requireCreds(input.credentials);
		const files = [...input.files];
		if (
			!files.some(
				(f) => f.path === 'staticwebapp.config.json' || f.path.endsWith('/staticwebapp.config.json')
			)
		) {
			files.push({
				path:
					input.mode === 'path' && input.basePath
						? `${input.basePath.replace(/^\//, '')}/staticwebapp.config.json`
						: 'staticwebapp.config.json',
				content: SWA_CONFIG,
				contentType: 'application/json; charset=utf-8'
			});
		}

		const staging = stageFiles(input.project.slug, files);
		ensureSwaConfig(staging);

		const binary = await resolveStaticSitesClient();
		await runStaticSitesClient(binary, {
			DEPLOYMENT_ACTION: 'upload',
			DEPLOYMENT_PROVIDER: 'SkinnyStatus',
			SKIP_APP_BUILD: 'true',
			SKIP_API_BUILD: 'true',
			DEPLOYMENT_TOKEN: creds.deploymentToken,
			APP_LOCATION: staging,
			VERBOSE: 'false'
		});

		let providerId = input.providerId;
		try {
			providerId = providerId || new URL(creds.publicBaseUrl).hostname;
		} catch {
			providerId = providerId || creds.publicBaseUrl;
		}

		return {
			url: joinUrl(creds.publicBaseUrl, input.mode === 'path' ? input.basePath : ''),
			providerId
		};
	}
};
