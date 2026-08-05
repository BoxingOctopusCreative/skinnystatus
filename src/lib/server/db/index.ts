import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getConfig } from '$lib/server/config';
import * as pgSchema from './schema.pg';

export const dialect = 'postgres' as const;

/**
 * Drizzle's client is created lazily after initConfig() so Infisical secrets
 * can populate DATABASE_URL first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = any;

let _db: AppDb | null = null;

function createDb(): AppDb {
	const databaseUrl = getConfig().database.url;
	const client = postgres(databaseUrl);
	return drizzle(client, { schema: pgSchema });
}

function getDbInstance(): AppDb {
	if (!_db) _db = createDb();
	return _db;
}

export const db: AppDb = new Proxy({} as AppDb, {
	get(_target, prop, receiver) {
		const instance = getDbInstance();
		const value = Reflect.get(instance, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});

export const schema = pgSchema;

export const user = schema.user;
export const session = schema.session;
export const account = schema.account;
export const verification = schema.verification;
export const statusPage = schema.statusPage;
export const service = schema.service;
export const incident = schema.incident;
export const incidentUpdate = schema.incidentUpdate;
export const incidentService = schema.incidentService;
export const checkResult = schema.checkResult;
export const subscriber = schema.subscriber;
export const teamHostCredential = schema.teamHostCredential;
export const twoFactor = schema.twoFactor;
export const passkey = schema.passkey;
export const team = schema.team;
export const teamMember = schema.teamMember;
export const teamInvite = schema.teamInvite;
export const billingOrg = schema.billingOrg;
export const billingOrgMember = schema.billingOrgMember;

/** Test helper: drop the cached client so the next access reconnects. */
export function resetDbForTests(): void {
	_db = null;
}
