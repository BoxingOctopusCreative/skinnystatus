import { defineConfig } from 'drizzle-kit';
import { isPostgresUrl, loadDotEnvFile } from './src/lib/server/config.ts';

loadDotEnvFile();

const url = process.env.DATABASE_URL;
if (!url || !isPostgresUrl(url)) {
	throw new Error(
		'DATABASE_URL must be a Postgres URL (postgres:// or postgresql://). Set it in the environment, .env, or Infisical.'
	);
}

export default defineConfig({
	schema: './src/lib/server/db/schema.pg.ts',
	out: './drizzle/pg',
	dialect: 'postgresql',
	dbCredentials: { url },
	verbose: true,
	strict: true
});
