import { createHash, randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { assertCanCreateTeam } from '$lib/server/billing/limits';
import { ensureUserBillingOrg } from '$lib/server/billing/orgs';
import { getConfig } from '$lib/server/config';
import {
	db,
	statusPage,
	team,
	teamInvite,
	teamMember,
	user
} from '$lib/server/db';
import type { StatusPageRow } from '$lib/server/db/queries';
import { sendEmail } from '$lib/server/mailgun';
import type { TeamRole } from '$lib/server/db/schema.pg';

export const INVITE_GRACE_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const ROLE_RANK: Record<TeamRole, number> = {
	member: 1,
	admin: 2,
	owner: 3
};

export function hashInviteToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function isTeamRole(value: string): value is TeamRole {
	return value === 'owner' || value === 'admin' || value === 'member';
}

export function roleAtLeast(role: TeamRole, min: TeamRole): boolean {
	return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function slugifyTeamName(name: string): string {
	const base = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return base || `team-${crypto.randomUUID().slice(0, 8)}`;
}

async function allocateTeamSlug(base: string): Promise<string> {
	let candidate = base.slice(0, 63);
	let n = 2;
	while (true) {
		const [existing] = await db.select({ id: team.id }).from(team).where(eq(team.slug, candidate)).limit(1);
		if (!existing) return candidate;
		candidate = `${base.slice(0, 50)}-${n}`.slice(0, 63);
		n += 1;
		if (n > 100) return `team-${crypto.randomUUID().slice(0, 8)}`;
	}
}

export type TeamRow = {
	id: string;
	name: string;
	slug: string;
	billingOrgId: string;
	createdByUserId: string;
	bannerImage: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type TeamMemberRow = {
	id: string;
	teamId: string;
	userId: string;
	role: string;
	createdAt: Date;
};

export async function getTeamMembership(
	teamId: string,
	userId: string
): Promise<TeamMemberRow | undefined> {
	const [row] = await db
		.select()
		.from(teamMember)
		.where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)))
		.limit(1);
	return row;
}

export async function getTeamRole(teamId: string, userId: string): Promise<TeamRole | null> {
	const membership = await getTeamMembership(teamId, userId);
	if (!membership || !isTeamRole(membership.role)) return null;
	return membership.role;
}

export async function userCanManageTeam(teamId: string, userId: string): Promise<boolean> {
	const role = await getTeamRole(teamId, userId);
	return role != null && roleAtLeast(role, 'admin');
}

export async function requireTeamRole(
	teamId: string,
	userId: string,
	minRole: TeamRole
): Promise<TeamRole> {
	const role = await getTeamRole(teamId, userId);
	if (!role || !roleAtLeast(role, minRole)) {
		error(403, 'Insufficient team permissions');
	}
	return role;
}

export async function requireTeamMember(teamId: string, userId: string): Promise<TeamRole> {
	return requireTeamRole(teamId, userId, 'member');
}

export async function listTeamsForUser(userId: string): Promise<
	Array<TeamRow & { role: TeamRole; memberCount: number }>
> {
	const memberships = await db
		.select({
			teamId: teamMember.teamId,
			role: teamMember.role,
			id: team.id,
			name: team.name,
			slug: team.slug,
			billingOrgId: team.billingOrgId,
			createdByUserId: team.createdByUserId,
			bannerImage: team.bannerImage,
			createdAt: team.createdAt,
			updatedAt: team.updatedAt
		})
		.from(teamMember)
		.innerJoin(team, eq(team.id, teamMember.teamId))
		.where(eq(teamMember.userId, userId))
		.orderBy(team.name);

	const result: Array<TeamRow & { role: TeamRole; memberCount: number }> = [];
	for (const row of memberships) {
		if (!isTeamRole(row.role)) continue;
		const counts: Array<{ count: number }> = await db
			.select({ count: sql<number>`count(*)`.mapWith(Number) })
			.from(teamMember)
			.where(eq(teamMember.teamId, row.teamId));
		result.push({
			id: row.id,
			name: row.name,
			slug: row.slug,
			billingOrgId: row.billingOrgId,
			createdByUserId: row.createdByUserId,
			bannerImage: row.bannerImage,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			role: row.role,
			memberCount: counts[0]?.count ?? 0
		});
	}
	return result;
}

/** Teams where the user is owner or admin. */
export async function listManageableTeamsForUser(userId: string): Promise<TeamRow[]> {
	const rows = await db
		.select({
			id: team.id,
			name: team.name,
			slug: team.slug,
			billingOrgId: team.billingOrgId,
			createdByUserId: team.createdByUserId,
			bannerImage: team.bannerImage,
			createdAt: team.createdAt,
			updatedAt: team.updatedAt,
			role: teamMember.role
		})
		.from(teamMember)
		.innerJoin(team, eq(team.id, teamMember.teamId))
		.where(eq(teamMember.userId, userId))
		.orderBy(team.name);

	return rows
		.filter((r: { role: string }) => isTeamRole(r.role) && roleAtLeast(r.role, 'admin'))
		.map(({ role: _role, ...t }: TeamRow & { role: string }) => t);
}

export async function getTeamById(teamId: string): Promise<TeamRow | undefined> {
	const [row] = await db.select().from(team).where(eq(team.id, teamId)).limit(1);
	return row;
}

export async function createTeam(userId: string, name: string): Promise<TeamRow> {
	const trimmed = name.trim();
	if (!trimmed) throw new Error('Team name is required');

	const org = await ensureUserBillingOrg(userId);
	await assertCanCreateTeam(org.id);

	const slug = await allocateTeamSlug(slugifyTeamName(trimmed));
	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(team).values({
		id,
		name: trimmed,
		slug,
		billingOrgId: org.id,
		createdByUserId: userId,
		createdAt: now,
		updatedAt: now
	});
	await db.insert(teamMember).values({
		id: crypto.randomUUID(),
		teamId: id,
		userId,
		role: 'owner',
		createdAt: now
	});

	return {
		id,
		name: trimmed,
		slug,
		billingOrgId: org.id,
		createdByUserId: userId,
		bannerImage: null,
		createdAt: now,
		updatedAt: now
	};
}

/** Ensure the user belongs to at least one team (creates a personal team if needed). */
export async function ensureUserHasTeam(
	userId: string,
	opts?: { name?: string; email?: string }
): Promise<TeamRow> {
	const teams = await listTeamsForUser(userId);
	if (teams.length > 0) {
		const { role: _role, memberCount: _mc, ...row } = teams[0];
		return row;
	}

	const label =
		opts?.name?.trim() ||
		opts?.email?.split('@')[0]?.trim() ||
		'Personal';
	return createTeam(userId, `${label}'s team`);
}

export async function deleteTeam(teamId: string, userId: string): Promise<void> {
	await requireTeamRole(teamId, userId, 'owner');
	const existing = await getTeamById(teamId);
	if (existing?.bannerImage) {
		try {
			const { deleteObject, parseImageRef } = await import('$lib/server/r2');
			const ref = parseImageRef(existing.bannerImage);
			if (ref.kind === 'r2' && ref.value) await deleteObject(ref.value);
		} catch (err) {
			console.error('[skinnystatus] team banner cleanup failed', err);
		}
	}
	await db.delete(team).where(eq(team.id, teamId));
}

export async function leaveTeam(teamId: string, userId: string): Promise<void> {
	const role = await getTeamRole(teamId, userId);
	if (!role) error(404, 'Not a team member');
	if (role === 'owner') error(400, 'Owners cannot leave; transfer ownership or delete the team');
	await db
		.delete(teamMember)
		.where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, userId)));
}

export async function listTeamMembers(teamId: string): Promise<
	Array<{
		id: string;
		userId: string;
		role: TeamRole;
		createdAt: Date;
		name: string;
		email: string;
	}>
> {
	const rows = await db
		.select({
			id: teamMember.id,
			userId: teamMember.userId,
			role: teamMember.role,
			createdAt: teamMember.createdAt,
			name: user.name,
			email: user.email
		})
		.from(teamMember)
		.innerJoin(user, eq(user.id, teamMember.userId))
		.where(eq(teamMember.teamId, teamId))
		.orderBy(user.name);

	return rows
		.filter((r: { role: string }) => isTeamRole(r.role))
		.map((r: { id: string; userId: string; role: TeamRole; createdAt: Date; name: string; email: string }) => ({
			id: r.id,
			userId: r.userId,
			role: r.role,
			createdAt: r.createdAt,
			name: r.name,
			email: r.email
		}));
}

export async function setMemberRole(
	teamId: string,
	actorUserId: string,
	targetUserId: string,
	newRole: 'admin' | 'member'
): Promise<void> {
	await requireTeamRole(teamId, actorUserId, 'owner');
	if (targetUserId === actorUserId) error(400, 'Cannot change your own role');

	const target = await getTeamMembership(teamId, targetUserId);
	if (!target) error(404, 'Member not found');
	if (target.role === 'owner') error(400, 'Cannot change the owner role');

	await db
		.update(teamMember)
		.set({ role: newRole })
		.where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, targetUserId)));
}

export async function removeMember(
	teamId: string,
	actorUserId: string,
	targetUserId: string
): Promise<void> {
	const actorRole = await requireTeamRole(teamId, actorUserId, 'admin');
	if (targetUserId === actorUserId) {
		await leaveTeam(teamId, actorUserId);
		return;
	}

	const target = await getTeamMembership(teamId, targetUserId);
	if (!target || !isTeamRole(target.role)) error(404, 'Member not found');
	if (target.role === 'owner') error(400, 'Cannot remove the team owner');
	if (target.role === 'admin' && actorRole !== 'owner') {
		error(403, 'Only the owner can remove admins');
	}

	await db
		.delete(teamMember)
		.where(and(eq(teamMember.teamId, teamId), eq(teamMember.userId, targetUserId)));
}

export async function userCanAccessPage(userId: string, pageId: string): Promise<boolean> {
	const [row] = await db
		.select({ id: statusPage.id })
		.from(statusPage)
		.innerJoin(teamMember, eq(teamMember.teamId, statusPage.teamId))
		.where(and(eq(statusPage.id, pageId), eq(teamMember.userId, userId)))
		.limit(1);
	return Boolean(row);
}

export async function userCanMutatePage(userId: string, pageId: string): Promise<boolean> {
	return userCanAccessPage(userId, pageId);
}

export async function userCanManagePageLifecycle(
	userId: string,
	pageId: string
): Promise<boolean> {
	const [row] = await db
		.select({ role: teamMember.role })
		.from(statusPage)
		.innerJoin(teamMember, eq(teamMember.teamId, statusPage.teamId))
		.where(and(eq(statusPage.id, pageId), eq(teamMember.userId, userId)))
		.limit(1);
	if (!row || !isTeamRole(row.role)) return false;
	return roleAtLeast(row.role, 'admin');
}

export async function getAccessibleStatusPage(
	pageId: string,
	userId: string
): Promise<StatusPageRow | undefined> {
	const can = await userCanAccessPage(userId, pageId);
	if (!can) return undefined;
	const [row] = await db.select().from(statusPage).where(eq(statusPage.id, pageId)).limit(1);
	return row;
}

/** All projects on teams the user belongs to (includes soft-deleted). */
export async function listAccessibleStatusPages(userId: string): Promise<StatusPageRow[]> {
	const memberships = await db
		.select({ teamId: teamMember.teamId })
		.from(teamMember)
		.where(eq(teamMember.userId, userId));
	const teamIds = memberships.map((m: { teamId: string }) => m.teamId);
	if (teamIds.length === 0) return [];
	return db
		.select()
		.from(statusPage)
		.where(inArray(statusPage.teamId, teamIds))
		.orderBy(statusPage.name);
}

export async function listAccessibleActiveStatusPages(userId: string): Promise<StatusPageRow[]> {
	const pages = await listAccessibleStatusPages(userId);
	return pages.filter((p) => p.deletedAt == null);
}

export async function listStatusPagesForTeam(teamId: string): Promise<StatusPageRow[]> {
	return db
		.select()
		.from(statusPage)
		.where(eq(statusPage.teamId, teamId))
		.orderBy(statusPage.name);
}

export async function listActiveStatusPagesForTeam(teamId: string): Promise<StatusPageRow[]> {
	return db
		.select()
		.from(statusPage)
		.where(and(eq(statusPage.teamId, teamId), isNull(statusPage.deletedAt)))
		.orderBy(statusPage.name);
}

export type InviteRow = {
	id: string;
	teamId: string;
	email: string | null;
	role: string;
	expiresAt: Date;
	acceptedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
	createdByUserId: string;
};

export async function listPendingInvites(teamId: string): Promise<InviteRow[]> {
	const rows = await db
		.select()
		.from(teamInvite)
		.where(eq(teamInvite.teamId, teamId))
		.orderBy(teamInvite.createdAt);

	const now = new Date();
	return rows.filter(
		(r: InviteRow) => !r.acceptedAt && !r.revokedAt && r.expiresAt > now
	);
}

export async function createTeamInvite(opts: {
	teamId: string;
	createdByUserId: string;
	email?: string | null;
	role?: 'admin' | 'member';
}): Promise<{ invite: InviteRow; token: string; link: string }> {
	await requireTeamRole(opts.teamId, opts.createdByUserId, 'admin');

	const role = opts.role ?? 'member';
	if (role !== 'admin' && role !== 'member') {
		throw new Error('Invalid invite role');
	}

	const email = opts.email?.trim().toLowerCase() || null;
	const token = randomBytes(32).toString('hex');
	const tokenHash = hashInviteToken(token);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + INVITE_GRACE_DAYS * MS_PER_DAY);
	const id = crypto.randomUUID();

	await db.insert(teamInvite).values({
		id,
		teamId: opts.teamId,
		email,
		role,
		tokenHash,
		createdByUserId: opts.createdByUserId,
		expiresAt,
		createdAt: now
	});

	const baseUrl = getConfig().site.baseUrl.replace(/\/$/, '');
	const link = `${baseUrl}/invite/${token}`;

	if (email) {
		const [teamRow] = await db.select().from(team).where(eq(team.id, opts.teamId)).limit(1);
		try {
			await sendEmail({
				to: email,
				subject: `Join ${teamRow?.name ?? 'a team'} on SkinnyStatus`,
				text: `You've been invited to join ${teamRow?.name ?? 'a team'} on SkinnyStatus.\n\nAccept the invite:\n\n${link}\n\nThis link expires in ${INVITE_GRACE_DAYS} days.`
			});
		} catch (err) {
			console.error('[skinnystatus] team invite email failed', err);
		}
	}

	return {
		invite: {
			id,
			teamId: opts.teamId,
			email,
			role,
			expiresAt,
			acceptedAt: null,
			revokedAt: null,
			createdAt: now,
			createdByUserId: opts.createdByUserId
		},
		token,
		link
	};
}

export async function revokeInvite(
	inviteId: string,
	actorUserId: string
): Promise<void> {
	const [invite] = await db.select().from(teamInvite).where(eq(teamInvite.id, inviteId)).limit(1);
	if (!invite) error(404, 'Invite not found');
	await requireTeamRole(invite.teamId, actorUserId, 'admin');
	await db
		.update(teamInvite)
		.set({ revokedAt: new Date() })
		.where(eq(teamInvite.id, inviteId));
}

export async function findValidInviteByToken(token: string): Promise<
	| (InviteRow & { teamName: string })
	| null
> {
	const tokenHash = hashInviteToken(token);
	const [row] = await db
		.select({
			id: teamInvite.id,
			teamId: teamInvite.teamId,
			email: teamInvite.email,
			role: teamInvite.role,
			expiresAt: teamInvite.expiresAt,
			acceptedAt: teamInvite.acceptedAt,
			revokedAt: teamInvite.revokedAt,
			createdAt: teamInvite.createdAt,
			createdByUserId: teamInvite.createdByUserId,
			teamName: team.name
		})
		.from(teamInvite)
		.innerJoin(team, eq(team.id, teamInvite.teamId))
		.where(eq(teamInvite.tokenHash, tokenHash))
		.limit(1);

	if (!row) return null;
	if (row.acceptedAt || row.revokedAt) return null;
	if (row.expiresAt <= new Date()) return null;
	return row;
}

export async function acceptTeamInvite(
	token: string,
	userId: string,
	userEmail: string
): Promise<{ teamId: string }> {
	const invite = await findValidInviteByToken(token);
	if (!invite) {
		throw new Error('Invite is invalid or expired');
	}

	if (invite.email && invite.email.toLowerCase() !== userEmail.toLowerCase()) {
		throw new Error('This invite was sent to a different email address');
	}

	const existing = await getTeamMembership(invite.teamId, userId);
	if (!existing) {
		const role = invite.role === 'admin' ? 'admin' : 'member';
		await db.insert(teamMember).values({
			id: crypto.randomUUID(),
			teamId: invite.teamId,
			userId,
			role,
			createdAt: new Date()
		});
	}

	await db
		.update(teamInvite)
		.set({ acceptedAt: new Date() })
		.where(eq(teamInvite.id, invite.id));

	return { teamId: invite.teamId };
}
