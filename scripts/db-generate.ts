import { spawnSync } from 'node:child_process';
import { initConfig } from '../src/lib/server/config.ts';

await initConfig();

const result = spawnSync(
	'npx',
	['drizzle-kit', 'generate', '--config', 'drizzle.config.ts'],
	{
		stdio: 'inherit',
		shell: true,
		env: process.env
	}
);

process.exit(result.status ?? 1);
