import { resolve } from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { getConfig } from '../config';

const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle/pg');
const MIGRATIONS_TABLE = '__drizzle_migrations';

let migrated = false;

type Sql = ReturnType<typeof postgres>;

async function ensureMigrationsTable(sql: Sql): Promise<void> {
	// Keep the ledger in public — managed Postgres often forbids CREATE SCHEMA.
	const [{ exists }] = await sql`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_name = ${MIGRATIONS_TABLE}
		) AS exists
	`;
	if (exists) return;

	await sql.unsafe(`
		CREATE TABLE ${MIGRATIONS_TABLE} (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)
	`);
}


/**
 * If the schema was created via db:push (or equivalent) before migrations existed,
 * record current migration hashes without re-running CREATE TABLE.
 */
async function baselineExistingSchemaIfNeeded(
	sql: Sql,
	migrations: ReturnType<typeof readMigrationFiles>
): Promise<boolean> {
	const applied = await sql.unsafe(
		`SELECT id FROM ${MIGRATIONS_TABLE} LIMIT 1`
	);
	if (applied.length > 0) return false;

	const [{ exists }] = await sql`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_name = 'user'
		) AS exists
	`;
	if (!exists) return false;

	for (const migration of migrations) {
		await sql`
			INSERT INTO ${sql(MIGRATIONS_TABLE)} ("hash", "created_at")
			VALUES (${migration.hash}, ${migration.folderMillis})
		`;
	}
	console.info(
		`[skinnystatus] Baselined existing database to ${migrations.length} migration(s)`
	);
	return true;
}

async function applyPendingMigrations(
	sql: Sql,
	migrations: ReturnType<typeof readMigrationFiles>
): Promise<number> {
	const rows = await sql.unsafe(
		`SELECT hash, created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`
	);
	const lastCreatedAt = rows[0] ? Number(rows[0].created_at) : null;
	let applied = 0;

	for (const migration of migrations) {
		if (lastCreatedAt !== null && lastCreatedAt >= migration.folderMillis) {
			continue;
		}

		await sql.begin(async (tx) => {
			for (const stmt of migration.sql) {
				const trimmed = stmt.trim();
				if (!trimmed) continue;
				await tx.unsafe(trimmed);
			}
			await tx`
				INSERT INTO ${tx(MIGRATIONS_TABLE)} ("hash", "created_at")
				VALUES (${migration.hash}, ${migration.folderMillis})
			`;
		});
		applied += 1;
	}

	return applied;
}

/**
 * Apply any pending Drizzle SQL migrations. Safe to call on every startup;
 * already-applied migrations are skipped via `__drizzle_migrations`.
 */
export async function ensureDatabaseMigrated(): Promise<void> {
	if (migrated) return;

	const url = getConfig().database.url;
	const sql = postgres(url, { max: 1 });

	try {
		console.info('[skinnystatus] Checking database migrations…');
		const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
		await ensureMigrationsTable(sql);
		await baselineExistingSchemaIfNeeded(sql, migrations);
		const applied = await applyPendingMigrations(sql, migrations);
		if (applied > 0) {
			console.info(`[skinnystatus] Applied ${applied} migration(s)`);
		} else {
			console.info('[skinnystatus] Database migrations up to date');
		}
		migrated = true;
	} catch (error) {
		console.error('[skinnystatus] Database migration failed', error);
		throw error;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

/** Test helper */
export function resetMigrationFlagForTests(): void {
	migrated = false;
}
