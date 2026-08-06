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
 * Vercel project names: lowercase; letters, digits, `.`, `_`, `-`; max 100;
 * cannot contain `---` (https://vercel.com/docs/projects/overview#project-name).
 */
export function sanitizeVercelProjectName(raw: string): string {
	let name = raw
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/-{2,}/g, '-')
		.replace(/^[-._]+|[-._]+$/g, '')
		.slice(0, 100)
		.replace(/[-._]+$/g, '');
	return name || 'skinnystatus';
}

/**
 * Stable, always-valid project name from the status page id (UUID hex only).
 * Avoids slug edge cases (`---`, unicode, etc.) that Vercel rejects.
 */
export function vercelProjectName(project: { id: string; slug?: string }): string {
	const idHex = project.id.replace(/-/g, '').toLowerCase();
	if (/^[a-f0-9]{32}$/.test(idHex)) {
		return `skinnystatus-${idHex}`;
	}
	// Non-UUID ids (tests / legacy): fall back to sanitized slug or id.
	const fallback = project.slug?.trim() || project.id;
	return sanitizeVercelProjectName(`skinnystatus-${fallback}`);
}

function isVercelProjectId(value: string): boolean {
	return /^prj_[A-Za-z0-9]+$/.test(value);
}

export const vercelAdapter: DeployAdapter = {
	provider: 'vercel',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { token, teamId } = requireToken(input.credentials);
		const name = vercelProjectName(input.project);

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
