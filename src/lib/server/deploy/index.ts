import { cpSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { getConfig } from '$lib/server/config';
import { requireHostCredentials } from '$lib/server/host-credentials';
import type { HostProvider, StatusPageInfo } from '$lib/publishing';
import { cnameTargetForProvider, isHostProvider } from '$lib/publishing';
import type { DeployFile } from './types';
import { azureSwaAdapter } from './azure-swa';
import { cloudflarePagesAdapter } from './cloudflare';
import {
	domainRegisterInputForProject,
	registerCustomDomain
} from './domains';
import { firebaseHostingAdapter } from './firebase';
import { githubPagesAdapter } from './github-pages';
import { netlifyAdapter } from './netlify';
import { amazonS3Adapter } from './s3';
import { staticAppAdapter } from './static-app';
import { vercelAdapter } from './vercel';
import type { DeployAdapter, DeployResult } from './types';
export { ensureStagingDir, stageFiles } from './staging';

const adapters: Record<string, DeployAdapter> = {
	vercel: vercelAdapter,
	cloudflare_pages: cloudflarePagesAdapter,
	netlify: netlifyAdapter,
	github_pages: githubPagesAdapter,
	static_app: staticAppAdapter,
	amazon_s3: amazonS3Adapter,
	firebase_hosting: firebaseHostingAdapter,
	azure_static_web_apps: azureSwaAdapter
};

function templateRoot(): string {
	return resolve(process.cwd(), 'packages/status-page-template');
}

function distRoot(): string {
	return join(templateRoot(), 'dist');
}

function walkFiles(dir: string, base = dir): DeployFile[] {
	const out: DeployFile[] = [];
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			out.push(...walkFiles(full, base));
		} else {
			const rel = relative(base, full).split('\\').join('/');
			out.push({
				path: rel,
				content: readFileSync(full),
				contentType: contentTypeFor(rel)
			});
		}
	}
	return out;
}

function contentTypeFor(path: string): string {
	if (path.endsWith('.html')) return 'text/html; charset=utf-8';
	if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
	if (path.endsWith('.css')) return 'text/css; charset=utf-8';
	if (path.endsWith('.json')) return 'application/json; charset=utf-8';
	if (path.endsWith('.svg')) return 'image/svg+xml';
	return 'application/octet-stream';
}

function configJs(project: StatusPageInfo, basePath: string): string {
	const apiBase = getConfig().site.baseUrl.replace(/\/$/, '');
	const payload = {
		apiBase,
		pageSlug: project.slug,
		basePath,
		pollIntervalMs: 60_000,
		theme: project.theme
	};
	return `window.__SKINNY_STATUS__ = ${JSON.stringify(payload, null, 2)};\n`;
}

/**
 * Build deploy file list from the prebuilt template dist + injected config.js.
 * Path mode nests files under `{pathPrefix}/{slug}/` so a single provider site can host many pages.
 */
export async function prepareDeployFiles(project: StatusPageInfo): Promise<{
	files: DeployFile[];
	basePath: string;
}> {
	const dist = distRoot();
	if (!existsSync(join(dist, 'index.html'))) {
		throw new Error(
			'Status page template is not built. Run: npm run build:status-template'
		);
	}

	const pathPrefix = project.publishPathPrefix || 's';
	const basePath =
		project.publishMode === 'path' ? `/${pathPrefix}/${project.slug}` : '';

	const raw = walkFiles(dist);
	const injected = raw.map((file) => {
		if (file.path === 'config.js') {
			return { ...file, content: configJs(project, basePath) };
		}
		return file;
	});

	if (!injected.some((f) => f.path === 'config.js')) {
		injected.push({
			path: 'config.js',
			content: configJs(project, basePath),
			contentType: 'application/javascript; charset=utf-8'
		});
	}

	if (project.publishMode === 'path' && basePath) {
		const prefix = basePath.replace(/^\//, '');
		const nested = injected.map((f) => ({
			...f,
			path: `${prefix}/${f.path}`
		}));
		// SPA fallback at site root for provider default routes
		nested.push({
			path: 'index.html',
			content: `<!doctype html><html><head><meta http-equiv="refresh" content="0;url=${basePath}/" /></head><body></body></html>`,
			contentType: 'text/html; charset=utf-8'
		});
		return { files: nested, basePath };
	}

	return { files: injected, basePath };
}

export async function deployProject(
	project: StatusPageInfo,
	userId: string
): Promise<DeployResult> {
	if (!isHostProvider(project.hostProvider)) {
		throw new Error(`Unknown host provider: ${project.hostProvider}`);
	}
	const provider = project.hostProvider as HostProvider;
	const adapter = adapters[provider];
	if (!adapter) {
		throw new Error(`Unknown host provider: ${provider}`);
	}

	const credentials = await requireHostCredentials(project.teamId, provider);
	const { files, basePath } = await prepareDeployFiles(project);
	const result = await adapter.deploy({
		files,
		project,
		mode: project.publishMode,
		basePath,
		providerId: project.deployProviderId,
		credentials
	});

	const domainInput = domainRegisterInputForProject(project, result, credentials);
	if (!domainInput) return result;

	try {
		const registered = await registerCustomDomain(domainInput);
		if (!registered) return result;
		return {
			...result,
			url: registered.verified ? `https://${registered.hostname}` : result.url,
			customDomain: {
				hostname: registered.hostname,
				registered: true,
				verified: registered.verified,
				cnameTarget: registered.cnameTarget
			}
		};
	} catch (e) {
		const warning =
			e instanceof Error ? e.message : 'Custom domain registration failed';
		return {
			...result,
			customDomain: {
				hostname: domainInput.hostname,
				registered: false,
				verified: false,
				cnameTarget: cnameTargetForProvider(provider, {
					deployProviderId: result.providerId,
					deployUrl: result.url
				}),
				warning
			}
		};
	}
}

export function copyTemplateDistTo(target: string): void {
	const dist = distRoot();
	if (!existsSync(dist)) {
		throw new Error('Template dist missing');
	}
	cpSync(dist, target, { recursive: true });
}
