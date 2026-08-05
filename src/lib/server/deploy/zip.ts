import { zipSync } from 'fflate';
import type { DeployFile } from './types';
import { textEncoder } from './types';

/** Build an in-memory zip from deploy files (paths relative to archive root). */
export function zipDeployFiles(files: DeployFile[]): Uint8Array {
	const entries: Record<string, Uint8Array> = {};
	for (const file of files) {
		const path = file.path.replace(/^\//, '');
		if (!path || path.endsWith('/')) continue;
		entries[path] = textEncoder(file.content);
	}
	return zipSync(entries, { level: 6 });
}
