import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DeployFile } from './types';

/** Ensure a writable temp staging dir exists (used by zip / binary-based adapters). */
export function ensureStagingDir(slug: string): string {
	const dir = resolve(process.cwd(), '.deploy-staging', slug);
	mkdirSync(dir, { recursive: true });
	return dir;
}

export function stageFiles(slug: string, files: DeployFile[]): string {
	const dir = ensureStagingDir(slug);
	for (const file of files) {
		const full = join(dir, file.path);
		mkdirSync(join(full, '..'), { recursive: true });
		writeFileSync(full, typeof file.content === 'string' ? file.content : file.content);
	}
	return dir;
}
