import { resolve } from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { getConfig } from '../config';

const MIGRATIONS_FOLDER = resolve(process.cwd(), 'drizzle/pg');
const MIGRATIONS_TABLE = '__drizzle_migrations';

let migrated = false;
let migratePromise: Promise<void> | null = null;

type Sql = ReturnType<typeof postgres>;
type Migration = ReturnType<typeof readMigrationFiles>[number];

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

async function appliedHashes(sql: Sql): Promise<Set<string>> {
	const rows = await sql.unsafe(`SELECT hash FROM ${MIGRATIONS_TABLE}`);
	return new Set(rows.map((row: { hash: string }) => String(row.hash)));
}

async function columnExists(sql: Sql, table: string, column: string): Promise<boolean> {
	const [{ exists }] = await sql`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = ${table}
				AND column_name = ${column}
		) AS exists
	`;
	return Boolean(exists);
}

async function tableExists(sql: Sql, table: string): Promise<boolean> {
	const [{ exists }] = await sql`
		SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_name = ${table}
		) AS exists
	`;
	return Boolean(exists);
}

/**
 * When the ledger is empty but the app schema already exists (legacy db:push),
 * record hashes only for migrations whose changes are already present.
 * Pending additive migrations stay unrecorded so applyPendingMigrations runs them.
 */
async function migrationAlreadyReflectedInSchema(
	sql: Sql,
	migration: Migration
): Promise<boolean> {
	const sqlText = migration.sql.join('\n');

	if (sqlText.includes('publish_path_prefix') || sqlText.includes('publish_base_domain')) {
		return columnExists(sql, 'team', 'publish_path_prefix');
	}

	if (sqlText.includes('CREATE TABLE "billing_org"')) {
		return tableExists(sql, 'billing_org');
	}

	// Older migrations: if core auth tables exist, treat as already applied.
	return tableExists(sql, 'user');
}

async function baselineExistingSchemaIfNeeded(
	sql: Sql,
	migrations: Migration[]
): Promise<number> {
	const existing = await appliedHashes(sql);
	if (existing.size > 0) return 0;
	if (!(await tableExists(sql, 'user'))) return 0;

	let recorded = 0;
	for (const migration of migrations) {
		if (!(await migrationAlreadyReflectedInSchema(sql, migration))) continue;
		await sql`
			INSERT INTO ${sql(MIGRATIONS_TABLE)} ("hash", "created_at")
			VALUES (${migration.hash}, ${migration.folderMillis})
		`;
		recorded += 1;
	}

	if (recorded > 0) {
		console.info(
			`[skinnystatus] Baselined existing database for ${recorded} migration(s) already in schema`
		);
	}
	return recorded;
}

async function applyPendingMigrations(sql: Sql, migrations: Migration[]): Promise<number> {
	const done = await appliedHashes(sql);
	let applied = 0;

	for (const migration of migrations) {
		if (done.has(migration.hash)) continue;

		console.info(
			`[skinnystatus] Applying migration folderMillis=${migration.folderMillis} hash=${migration.hash.slice(0, 12)}…`
		);

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
		done.add(migration.hash);
		applied += 1;
	}

	return applied;
}

/**
 * Apply any pending Drizzle SQL migrations. Safe to call on every startup;
 * already-applied migrations are skipped via `__drizzle_migrations` hashes.
 */
export async function ensureDatabaseMigrated(): Promise<void> {
	if (migrated) return;
	if (migratePromise) return migratePromise;

	migratePromise = (async () => {
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
			migratePromise = null;
			throw error;
		} finally {
			await sql.end({ timeout: 5 });
		}
	})();

	return migratePromise;
}

/** Test helper */
export function resetMigrationFlagForTests(): void {
	migrated = false;
	migratePromise = null;
}
