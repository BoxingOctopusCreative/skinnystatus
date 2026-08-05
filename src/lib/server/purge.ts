import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { building } from '$app/environment';
import { ACCOUNT_GRACE_DAYS, PAGE_GRACE_DAYS } from '$lib/server/account-lifecycle';
import { db, statusPage, user } from '$lib/server/db';
import { deleteObject, parseImageRef } from '$lib/server/r2';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PURGE_INTERVAL_MS = MS_PER_DAY;

let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

export async function runPurgeOnce(): Promise<void> {
	const now = Date.now();
	const pageCutoff = new Date(now - PAGE_GRACE_DAYS * MS_PER_DAY);
	const accountCutoff = new Date(now - ACCOUNT_GRACE_DAYS * MS_PER_DAY);

	await db
		.delete(statusPage)
		.where(and(isNotNull(statusPage.deletedAt), lt(statusPage.deletedAt, pageCutoff)));

	const expiredUsers = await db
		.select()
		.from(user)
		.where(and(isNotNull(user.deletedAt), lt(user.deletedAt, accountCutoff)));

	for (const expired of expiredUsers) {
		const ref = parseImageRef(expired.image);
		if (ref.kind === 'r2' && ref.value) {
			try {
				await deleteObject(ref.value);
			} catch (err) {
				console.error('[skinnystatus] purge avatar delete failed', expired.id, err);
			}
		}

		await db.delete(user).where(eq(user.id, expired.id));
	}
}

export function startPurgeJob(): void {
	if (building || started) return;
	started = true;

	void runPurgeOnce().catch((err) => console.error('[skinnystatus] purge run failed', err));

	timer = setInterval(() => {
		void runPurgeOnce().catch((err) => console.error('[skinnystatus] purge run failed', err));
	}, PURGE_INTERVAL_MS);

	if (typeof timer === 'object' && 'unref' in timer) {
		timer.unref();
	}
}

export function stopPurgeJob(): void {
	if (timer) clearInterval(timer);
	timer = null;
	started = false;
}
