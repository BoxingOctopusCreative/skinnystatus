import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { asString, textEncoder } from './types';
import type { VercelHostCreds } from '$lib/server/host-credentials';

function requireToken(credentials: DeployInput['credentials']): {
	token: string;
	teamId: string | null;
} {
	const creds = credentials as VercelHostCreds;
	if (!creds?.token) {
		throw new Error(
			'Vercel credentials missing. Add a token under Dashboard → Settings.'
		);
	}
	return { token: creds.token, teamId: creds.teamId ?? null };
}

function teamQuery(teamId: string | null): string {
	return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}

async function vercelFetch(
	path: string,
	token: string,
	init?: RequestInit
): Promise<Response> {
	return fetch(`https://api.vercel.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			...(init?.headers ?? {})
		}
	});
}

/**
 * Official Vercel project name rules:
 * https://vercel.com/docs/project-configuration/general-settings#project-name
 * lowercase; letters, digits, `.`, `_`, `-`; max 100; no `---`.
 *
 * We also keep names ≤40 so `{name}-{hash}-{team}.vercel.app` stays under
 * the 63-character DNS label limit.
 */
export const VERCEL_API_NAME_MAX = 100;
export const VERCEL_PROJECT_NAME_MAX = 40;

/** Allowed chars per Vercel (lowercase already required separately). */
const VERCEL_NAME_CHARS = /^[a-z0-9._-]+$/;

/**
 * Returns an error message matching Vercel's rejection reasons, or null if valid.
 * Enforces the API rules plus our shorter deploy length budget.
 */
export function vercelProjectNameError(name: string): string | null {
	if (!name) {
		return 'Project name is required';
	}
	if (name !== name.toLowerCase()) {
		return 'Project names must be lowercase';
	}
	if (name.length > VERCEL_API_NAME_MAX) {
		return `Project names can be up to ${VERCEL_API_NAME_MAX} characters long`;
	}
	if (name.length > VERCEL_PROJECT_NAME_MAX) {
		return `Project names can be up to ${VERCEL_PROJECT_NAME_MAX} characters long`;
	}
	if (!VERCEL_NAME_CHARS.test(name)) {
		return 'Project names can only include letters, digits, and the characters `.`, `_`, `-`';
	}
	if (name.includes('---')) {
		return 'Project names cannot contain the sequence `---`';
	}
	return null;
}

export function assertValidVercelProjectName(name: string): void {
	const error = vercelProjectNameError(name);
	if (error) throw new Error(error);
}

export function sanitizeVercelProjectName(raw: string): string {
	let name = raw
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-._]+|[-._]+$/g, '')
		.slice(0, VERCEL_PROJECT_NAME_MAX)
		.replace(/[-._]+$/g, '');
	name = name || 'ss';
	assertValidVercelProjectName(name);
	return name;
}

/**
 * Short, stable name from the status page id.
 * `ss-` + 32 hex = 35 chars (fits `{name}-{hash}-{team}` under 63).
 */
export function vercelProjectName(project: { id: string; slug?: string }): string {
	const idHex = project.id.replace(/-/g, '').toLowerCase();
	if (/^[a-f0-9]{32}$/.test(idHex)) {
		const name = `ss-${idHex}`;
		assertValidVercelProjectName(name);
		return name;
	}
	const fallback = project.slug?.trim() || project.id;
	return sanitizeVercelProjectName(`ss-${fallback}`);
}

function isVercelProjectId(value: string): boolean {
	return /^prj_[A-Za-z0-9]+$/.test(value);
}

export const vercelAdapter: DeployAdapter = {
	provider: 'vercel',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { token, teamId } = requireToken(input.credentials);
		const name = vercelProjectName(input.project);
		assertValidVercelProjectName(name);

		const files = input.files.map((f) => ({
			file: f.path.replace(/^\//, ''),
			data: Buffer.from(textEncoder(f.content)).toString('base64'),
			encoding: 'base64' as const
		}));

		const body: Record<string, unknown> = {
			name,
			files,
			projectSettings: {
				framework: null
			}
		};

		// `project` overrides `name`. Only pass Vercel project ids.
		// Legacy rows may store a slug-based name (possibly with `---`) here.
		if (input.providerId && isVercelProjectId(input.providerId)) {
			body.project = input.providerId;
		}

		const res = await vercelFetch(`/v13/deployments${teamQuery(teamId)}`, token, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});

		if (!res.ok) {
			const text = await res.text();
			const projectRef =
				typeof body.project === 'string' ? ` project=${body.project}` : ' project=(none)';
			throw new Error(
				`Vercel deploy failed (${res.status}) name=${name}${projectRef}: ${text.slice(0, 400)}`
			);
		}

		const data = (await res.json()) as {
			url?: string;
			id?: string;
			projectId?: string;
			alias?: string[];
		};

		const host = data.url ?? data.alias?.[0];
		if (!host) throw new Error('Vercel deploy succeeded but returned no URL');

		let url = host.startsWith('http') ? host : `https://${host}`;
		if (input.mode === 'path' && input.basePath) {
			url = `${url.replace(/\/$/, '')}${input.basePath}`;
		}

		return {
			url,
			providerId: data.projectId ?? (input.providerId && isVercelProjectId(input.providerId)
				? input.providerId
				: name)
		};
	}
};

/** Exported for tests / diagnostics */
export function summarizeVercelFiles(input: DeployInput): string[] {
	return input.files.map((f) => `${f.path} (${asString(f.content).length}b)`);
}
