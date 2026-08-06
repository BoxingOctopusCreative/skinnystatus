import { relations } from 'drizzle-orm';
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	primaryKey,
	uniqueIndex
} from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	username: text('username').unique(),
	displayUsername: text('display_username'),
	twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
	deletedAt: timestamp('deleted_at', { withTimezone: true }),
	reactivationTokenHash: text('reactivation_token_hash'),
	reactivationTokenExpiresAt: timestamp('reactivation_token_expires_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

export const statusPage = pgTable(
	'status_page',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		description: text('description'),
		publishMode: text('publish_mode').notNull().default('path'),
		hostProvider: text('host_provider').notNull().default('vercel'),
		ownerId: text('owner_id').references(() => user.id, { onDelete: 'cascade' }),
		teamId: text('team_id')
			.notNull()
			.references(() => team.id, { onDelete: 'cascade' }),
		themeJson: text('theme_json'),
		deployUrl: text('deploy_url'),
		deployProviderId: text('deploy_provider_id'),
		lastDeployedAt: timestamp('last_deployed_at', { withTimezone: true }),
		lastDeployError: text('last_deploy_error'),
		published: boolean('published').default(true).notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('status_page_team_idx').on(table.teamId)]
);

export const service = pgTable('service', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	statusPageId: text('status_page_id')
		.notNull()
		.references(() => statusPage.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	sortOrder: integer('sort_order').notNull().default(0),
	checkUrl: text('check_url'),
	expectedStatus: integer('expected_status').notNull().default(200),
	/** http | tcp | dns | ssl | postgres | mysql | redis; null = no automated check */
	checkType: text('check_type'),
	/** encryptJson payload for non-HTTP check settings (may include secrets) */
	checkConfig: text('check_config'),
	manualStatus: text('manual_status'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const incident = pgTable('incident', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	statusPageId: text('status_page_id')
		.notNull()
		.references(() => statusPage.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	status: text('status').notNull().default('investigating'),
	impact: text('impact').notNull().default('minor'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
	resolvedAt: timestamp('resolved_at', { withTimezone: true })
});

export const incidentUpdate = pgTable('incident_update', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	incidentId: text('incident_id')
		.notNull()
		.references(() => incident.id, { onDelete: 'cascade' }),
	body: text('body').notNull(),
	status: text('status').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const incidentService = pgTable(
	'incident_service',
	{
		incidentId: text('incident_id')
			.notNull()
			.references(() => incident.id, { onDelete: 'cascade' }),
		serviceId: text('service_id')
			.notNull()
			.references(() => service.id, { onDelete: 'cascade' })
	},
	(table) => [primaryKey({ columns: [table.incidentId, table.serviceId] })]
);

export const checkResult = pgTable(
	'check_result',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		serviceId: text('service_id')
			.notNull()
			.references(() => service.id, { onDelete: 'cascade' }),
		ok: boolean('ok').notNull(),
		latencyMs: integer('latency_ms'),
		statusCode: integer('status_code'),
		error: text('error'),
		checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('check_result_service_checked_idx').on(table.serviceId, table.checkedAt)]
);

export const subscriber = pgTable(
	'subscriber',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		statusPageId: text('status_page_id')
			.notNull()
			.references(() => statusPage.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		unsubscribeToken: text('unsubscribe_token').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('subscriber_page_email_idx').on(table.statusPageId, table.email)]
);

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));

export const serviceRelations = relations(service, ({ many, one }) => ({
	statusPage: one(statusPage, {
		fields: [service.statusPageId],
		references: [statusPage.id]
	}),
	checkResults: many(checkResult),
	incidentServices: many(incidentService)
}));

export const statusPageRelations = relations(statusPage, ({ many, one }) => ({
	owner: one(user, { fields: [statusPage.ownerId], references: [user.id] }),
	team: one(team, { fields: [statusPage.teamId], references: [team.id] }),
	services: many(service),
	incidents: many(incident),
	subscribers: many(subscriber)
}));

export const subscriberRelations = relations(subscriber, ({ one }) => ({
	statusPage: one(statusPage, {
		fields: [subscriber.statusPageId],
		references: [statusPage.id]
	})
}));

export const incidentRelations = relations(incident, ({ many, one }) => ({
	statusPage: one(statusPage, {
		fields: [incident.statusPageId],
		references: [statusPage.id]
	}),
	updates: many(incidentUpdate),
	incidentServices: many(incidentService)
}));

export const incidentUpdateRelations = relations(incidentUpdate, ({ one }) => ({
	incident: one(incident, { fields: [incidentUpdate.incidentId], references: [incident.id] })
}));

export const incidentServiceRelations = relations(incidentService, ({ one }) => ({
	incident: one(incident, {
		fields: [incidentService.incidentId],
		references: [incident.id]
	}),
	service: one(service, {
		fields: [incidentService.serviceId],
		references: [service.id]
	})
}));

export const checkResultRelations = relations(checkResult, ({ one }) => ({
	service: one(service, { fields: [checkResult.serviceId], references: [service.id] })
}));

/** Better Auth two-factor plugin */
export const twoFactor = pgTable(
	'two_factor',
	{
		id: text('id').primaryKey(),
		secret: text('secret').notNull(),
		backupCodes: text('backup_codes').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [
		index('two_factor_userId_idx').on(table.userId),
		index('two_factor_secret_idx').on(table.secret)
	]
);

/** Better Auth passkey plugin */
export const passkey = pgTable(
	'passkey',
	{
		id: text('id').primaryKey(),
		name: text('name'),
		publicKey: text('public_key').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		credentialID: text('credential_id').notNull(),
		counter: integer('counter').notNull(),
		deviceType: text('device_type').notNull(),
		backedUp: boolean('backed_up').notNull(),
		transports: text('transports'),
		createdAt: timestamp('created_at', { withTimezone: true }),
		aaguid: text('aaguid')
	},
	(table) => [
		index('passkey_userId_idx').on(table.userId),
		index('passkey_credentialID_idx').on(table.credentialID)
	]
);

export const twoFactorRelations = relations(twoFactor, ({ one }) => ({
	user: one(user, { fields: [twoFactor.userId], references: [user.id] })
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
	user: one(user, { fields: [passkey.userId], references: [user.id] })
}));

/** Billing org (owns Stripe subscription and teams) */
export const BILLING_ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type BillingOrgRole = (typeof BILLING_ORG_ROLES)[number];

export const billingOrg = pgTable(
	'billing_org',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		planId: text('plan_id').notNull().default('free'),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		stripeSubscriptionStatus: text('stripe_subscription_status'),
		currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('billing_org_created_by_idx').on(table.createdByUserId),
		uniqueIndex('billing_org_stripe_customer_uidx').on(table.stripeCustomerId)
	]
);

export const billingOrgMember = pgTable(
	'billing_org_member',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		orgId: text('org_id')
			.notNull()
			.references(() => billingOrg.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').notNull().default('member'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('billing_org_member_org_idx').on(table.orgId),
		index('billing_org_member_user_idx').on(table.userId),
		uniqueIndex('billing_org_member_org_user_uidx').on(table.orgId, table.userId)
	]
);

/** Team collaboration */
export const TEAM_ROLES = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const team = pgTable(
	'team',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		name: text('name').notNull(),
		slug: text('slug').notNull().unique(),
		billingOrgId: text('billing_org_id')
			.notNull()
			.references(() => billingOrg.id, { onDelete: 'restrict' }),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		bannerImage: text('banner_image'),
		/** Apex host for subdomain publish URL hints (no scheme). Null until set in Settings. */
		publishBaseDomain: text('publish_base_domain'),
		/** Path segment for path-mode deploy nesting and URL hints. */
		publishPathPrefix: text('publish_path_prefix').notNull().default('s'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('team_created_by_idx').on(table.createdByUserId),
		index('team_billing_org_idx').on(table.billingOrgId)
	]
);

export const teamMember = pgTable(
	'team_member',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		teamId: text('team_id')
			.notNull()
			.references(() => team.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').notNull().default('member'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('team_member_team_idx').on(table.teamId),
		index('team_member_user_idx').on(table.userId),
		uniqueIndex('team_member_team_user_uidx').on(table.teamId, table.userId)
	]
);

export const teamInvite = pgTable(
	'team_invite',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		teamId: text('team_id')
			.notNull()
			.references(() => team.id, { onDelete: 'cascade' }),
		email: text('email'),
		role: text('role').notNull().default('member'),
		tokenHash: text('token_hash').notNull().unique(),
		createdByUserId: text('created_by_user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('team_invite_team_idx').on(table.teamId),
		index('team_invite_token_hash_idx').on(table.tokenHash)
	]
);

export const teamHostCredential = pgTable(
	'team_host_credential',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		teamId: text('team_id')
			.notNull()
			.references(() => team.id, { onDelete: 'cascade' }),
		provider: text('provider').notNull(),
		ciphertext: text('ciphertext').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('team_host_credential_team_idx').on(table.teamId),
		uniqueIndex('team_host_credential_team_provider_uidx').on(table.teamId, table.provider)
	]
);

export const billingOrgRelations = relations(billingOrg, ({ many, one }) => ({
	createdBy: one(user, { fields: [billingOrg.createdByUserId], references: [user.id] }),
	members: many(billingOrgMember),
	teams: many(team)
}));

export const billingOrgMemberRelations = relations(billingOrgMember, ({ one }) => ({
	org: one(billingOrg, { fields: [billingOrgMember.orgId], references: [billingOrg.id] }),
	user: one(user, { fields: [billingOrgMember.userId], references: [user.id] })
}));

export const teamRelations = relations(team, ({ many, one }) => ({
	billingOrg: one(billingOrg, { fields: [team.billingOrgId], references: [billingOrg.id] }),
	createdBy: one(user, { fields: [team.createdByUserId], references: [user.id] }),
	members: many(teamMember),
	invites: many(teamInvite),
	statusPages: many(statusPage),
	hostCredentials: many(teamHostCredential)
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
	team: one(team, { fields: [teamMember.teamId], references: [team.id] }),
	user: one(user, { fields: [teamMember.userId], references: [user.id] })
}));

export const teamInviteRelations = relations(teamInvite, ({ one }) => ({
	team: one(team, { fields: [teamInvite.teamId], references: [team.id] }),
	createdBy: one(user, { fields: [teamInvite.createdByUserId], references: [user.id] })
}));

export const teamHostCredentialRelations = relations(teamHostCredential, ({ one }) => ({
	team: one(team, { fields: [teamHostCredential.teamId], references: [team.id] })
}));
