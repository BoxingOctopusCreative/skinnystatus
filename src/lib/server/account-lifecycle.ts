import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNotNull } from 'drizzle-orm';
import { getConfig } from '$lib/server/config';
import { db, session, user } from '$lib/server/db';
import { sendEmail } from '$lib/server/mailgun';

export const ACCOUNT_GRACE_DAYS = 30;
export const PAGE_GRACE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SoftDeletableUser = {
	deletedAt: Date | null;
};

export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function isAccountDeleted(accountUser: SoftDeletableUser): boolean {
	return accountUser.deletedAt != null;
}

export function isWithinReactivationGrace(accountUser: SoftDeletableUser): boolean {
	if (!accountUser.deletedAt) return false;
	const graceEnds = accountUser.deletedAt.getTime() + ACCOUNT_GRACE_DAYS * MS_PER_DAY;
	return Date.now() < graceEnds;
}

/** Soft-delete an account. Returns the raw reactivation token (for tests / callers). */
export async function softDeleteAccount(userId: string): Promise<string> {
	const [existing] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
	if (!existing) {
		throw new Error('User not found');
	}

	const now = new Date();
	const token = randomBytes(32).toString('hex');
	const tokenHash = hashToken(token);
	const expiresAt = new Date(now.getTime() + ACCOUNT_GRACE_DAYS * MS_PER_DAY);

	await db
		.update(user)
		.set({
			deletedAt: now,
			reactivationTokenHash: tokenHash,
			reactivationTokenExpiresAt: expiresAt
		})
		.where(eq(user.id, userId));

	await db.delete(session).where(eq(session.userId, userId));

	const baseUrl = getConfig().site.baseUrl.replace(/\/$/, '');
	const link = `${baseUrl}/reactivate?token=${token}`;
	try {
		await sendEmail({
			to: existing.email,
			subject: 'Reactivate your SkinnyStatus account',
			text: `Your SkinnyStatus account is scheduled for deletion.\n\nYou have ${ACCOUNT_GRACE_DAYS} days to reactivate it:\n\n${link}\n\nIf you did not request this, reactivate and change your password.`
		});
	} catch (err) {
		console.error('[skinnystatus] reactivation email failed', err);
	}

	return token;
}

export async function reactivateAccountByToken(token: string): Promise<boolean> {
	const tokenHash = hashToken(token);
	const now = new Date();

	const [match] = await db
		.select()
		.from(user)
		.where(
			and(
				eq(user.reactivationTokenHash, tokenHash),
				isNotNull(user.reactivationTokenExpiresAt),
				gt(user.reactivationTokenExpiresAt, now)
			)
		)
		.limit(1);

	if (!match) return false;

	await db
		.update(user)
		.set({
			deletedAt: null,
			reactivationTokenHash: null,
			reactivationTokenExpiresAt: null
		})
		.where(eq(user.id, match.id));

	return true;
}

export async function reactivateAccountByUserId(userId: string): Promise<boolean> {
	const [existing] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
	if (!existing || !isWithinReactivationGrace(existing)) return false;

	await db
		.update(user)
		.set({
			deletedAt: null,
			reactivationTokenHash: null,
			reactivationTokenExpiresAt: null
		})
		.where(eq(user.id, userId));

	return true;
}
