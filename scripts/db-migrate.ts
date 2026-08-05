import { initConfig } from '../src/lib/server/config.ts';
import { ensureDatabaseMigrated } from '../src/lib/server/db/migrate.ts';

await initConfig();
await ensureDatabaseMigrated();
