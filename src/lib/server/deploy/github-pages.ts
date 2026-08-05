import type { DeployAdapter, DeployInput, DeployResult } from './types';
import { asString } from './types';
import type { GitHubHostCreds } from '$lib/server/host-credentials';

function requireCreds(credentials: DeployInput['credentials']): GitHubHostCreds {
	const creds = credentials as GitHubHostCreds;
	if (!creds?.token || !creds?.owner) {
		throw new Error(
			'GitHub credentials missing. Add a token and owner under Dashboard → Settings.'
		);
	}
	return { token: creds.token, owner: creds.owner };
}

async function gh(
	path: string,
	token: string,
	init?: RequestInit
): Promise<Response> {
	return fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'SkinnyStatus',
			...(init?.headers ?? {})
		}
	});
}

async function ensureRepo(
	token: string,
	owner: string,
	repo: string
): Promise<void> {
	const res = await gh(`/repos/${owner}/${repo}`, token);
	if (res.ok) return;
	if (res.status !== 404) {
		const text = await res.text();
		throw new Error(`GitHub repo lookup failed (${res.status}): ${text.slice(0, 400)}`);
	}

	const create = await gh('/user/repos', token, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			name: repo,
			private: false,
			auto_init: true,
			description: 'SkinnyStatus static status page'
		})
	});
	if (!create.ok) {
		const text = await create.text();
		throw new Error(`GitHub repo create failed (${create.status}): ${text.slice(0, 400)}`);
	}
}

async function putFile(
	token: string,
	owner: string,
	repo: string,
	path: string,
	content: string,
	branch: string
): Promise<void> {
	const existing = await gh(
		`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
		token
	);
	let sha: string | undefined;
	if (existing.ok) {
		const data = (await existing.json()) as { sha?: string };
		sha = data.sha;
	}

	const body: Record<string, unknown> = {
		message: `Deploy status page ${path}`,
		content: Buffer.from(content, 'utf8').toString('base64'),
		branch
	};
	if (sha) body.sha = sha;

	const put = await gh(`/repos/${owner}/${repo}/contents/${path}`, token, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!put.ok) {
		const text = await put.text();
		throw new Error(`GitHub Contents API failed (${put.status}): ${text.slice(0, 400)}`);
	}
}

export const githubPagesAdapter: DeployAdapter = {
	provider: 'github_pages',
	async deploy(input: DeployInput): Promise<DeployResult> {
		const { token, owner } = requireCreds(input.credentials);
		const repo = `skinnystatus-${input.project.slug}`.slice(0, 100);
		const branch = 'gh-pages';

		await ensureRepo(token, owner, repo);

		// Ensure gh-pages branch exists (create from default if needed)
		const branchRes = await gh(`/repos/${owner}/${repo}/branches/${branch}`, token);
		if (branchRes.status === 404) {
			const mainRef = await gh(`/repos/${owner}/${repo}/git/ref/heads/main`, token);
			const masterRef =
				mainRef.ok ? mainRef : await gh(`/repos/${owner}/${repo}/git/ref/heads/master`, token);
			if (!masterRef.ok) {
				throw new Error('Could not find default branch to create gh-pages');
			}
			const ref = (await masterRef.json()) as { object: { sha: string } };
			const createBranch = await gh(`/repos/${owner}/${repo}/git/refs`, token, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					ref: `refs/heads/${branch}`,
					sha: ref.object.sha
				})
			});
			if (!createBranch.ok && createBranch.status !== 422) {
				const text = await createBranch.text();
				throw new Error(
					`Could not create gh-pages branch (${createBranch.status}): ${text.slice(0, 400)}`
				);
			}
		}

		for (const file of input.files) {
			const path = file.path.replace(/^\//, '');
			await putFile(token, owner, repo, path, asString(file.content), branch);
		}

		// Enable Pages on gh-pages
		await gh(`/repos/${owner}/${repo}/pages`, token, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				source: { branch, path: '/' }
			})
		});

		let url = `https://${owner}.github.io/${repo}`;
		if (input.mode === 'path' && input.basePath) {
			url = `${url}${input.basePath}`;
		}

		return { url, providerId: `${owner}/${repo}` };
	}
};
