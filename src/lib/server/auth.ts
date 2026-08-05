import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username, twoFactor } from 'better-auth/plugins';
import { passkey } from '@better-auth/passkey';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { eq } from 'drizzle-orm';
import { getRequestEvent } from '$app/server';
import { getConfig } from '$lib/server/config';
import { db, schema, user } from '$lib/server/db';
import { sendEmail } from '$lib/server/mailgun';

type AuthInstance = ReturnType<typeof createAuth>;

export type SocialAuthProvider = 'github' | 'google';

let _auth: AuthInstance | null = null;

function githubUsername(login: string): string {
	return login.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function googleUsername(email: string, name: string): string {
	const fromEmail = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9-]/g, '') ?? '';
	if (fromEmail) return fromEmail;
	const fromName = name.toLowerCase().replace(/[^a-z0-9-]/g, '');
	return fromName || 'user';
}

function createAuth() {
	const config = getConfig();
	const baseUrl = config.site.baseUrl;
	let rpID = 'localhost';
	try {
		rpID = new URL(baseUrl).hostname;
	} catch {
		// keep localhost
	}

	const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]['socialProviders']> = {};
	const trustedProviders: SocialAuthProvider[] = [];

	if (config.auth.githubClientId && config.auth.githubClientSecret) {
		socialProviders.github = {
			clientId: config.auth.githubClientId,
			clientSecret: config.auth.githubClientSecret,
			mapProfileToUser: (profile: {
				id: number | string;
				login: string;
				name?: string | null;
				email?: string | null;
				avatar_url?: string | null;
			}) => ({
				name: profile.name || profile.login,
				email: profile.email ?? undefined,
				image: profile.avatar_url ?? undefined,
				username: githubUsername(profile.login)
			})
		};
		trustedProviders.push('github');
	}

	if (config.auth.googleClientId && config.auth.googleClientSecret) {
		socialProviders.google = {
			clientId: config.auth.googleClientId,
			clientSecret: config.auth.googleClientSecret,
			mapProfileToUser: (profile: {
				sub: string;
				email: string;
				name: string;
				picture?: string;
			}) => ({
				name: profile.name,
				email: profile.email,
				image: profile.picture ?? undefined,
				username: googleUsername(profile.email, profile.name)
			})
		};
		trustedProviders.push('google');
	}

	return betterAuth({
		baseURL: baseUrl,
		secret: config.auth.secret,
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema
		}),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
			sendResetPassword: async ({ user: resetUser, token }) => {
				const link = `${baseUrl}/reset-password?token=${token}`;
				await sendEmail({
					to: resetUser.email,
					subject: 'Reset your SkinnyStatus password',
					text: `Reset your password using this link:\n\n${link}\n\nIf you did not request a reset, you can ignore this email.`
				});
			}
		},
		socialProviders: Object.keys(socialProviders).length ? socialProviders : undefined,
		account: {
			accountLinking: {
				enabled: true,
				trustedProviders
			}
		},
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						if (createdUser.image && /^https?:\/\//i.test(createdUser.image)) {
							try {
								const { uploadAvatarFromUrl } = await import('$lib/server/r2');
								const r2Image = await uploadAvatarFromUrl(createdUser.id, createdUser.image);
								if (r2Image) {
									await db
										.update(user)
										.set({ image: r2Image })
										.where(eq(user.id, createdUser.id));
								}
							} catch (err) {
								console.error('[skinnystatus] avatar upload after signup failed', err);
							}
						}
					}
				}
			}
		},
		plugins: [
			username(),
			twoFactor(),
			passkey({ rpID, rpName: 'SkinnyStatus' }),
			sveltekitCookies(getRequestEvent)
		]
	});
}

function getAuthInstance(): AuthInstance {
	if (!_auth) _auth = createAuth();
	return _auth;
}

export const auth: AuthInstance = new Proxy({} as AuthInstance, {
	get(_target, prop, receiver) {
		const instance = getAuthInstance();
		const value = Reflect.get(instance, prop, receiver);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});

export function isGithubOAuthEnabled(): boolean {
	const config = getConfig();
	return Boolean(config.auth.githubClientId && config.auth.githubClientSecret);
}

export function isGoogleOAuthEnabled(): boolean {
	const config = getConfig();
	return Boolean(config.auth.googleClientId && config.auth.googleClientSecret);
}

export function isSocialAuthProvider(value: string): value is SocialAuthProvider {
	return value === 'github' || value === 'google';
}

function isProviderEnabled(provider: SocialAuthProvider): boolean {
	return provider === 'github' ? isGithubOAuthEnabled() : isGoogleOAuthEnabled();
}

/** Start social OAuth; returns the provider redirect URL. */
export async function startSocialSignIn(
	headers: Headers,
	provider: SocialAuthProvider,
	callbackURL = '/dashboard'
): Promise<string | null> {
	if (!isProviderEnabled(provider)) return null;

	const safeCallback = callbackURL.startsWith('/') ? callbackURL : '/dashboard';
	const result = await auth.api.signInSocial({
		body: {
			provider,
			callbackURL: safeCallback,
			newUserCallbackURL: safeCallback,
			errorCallbackURL: `/dashboard/login?error=${provider}`
		},
		headers
	});

	return result.url ?? null;
}

/** Link a social provider to the signed-in user; returns the provider redirect URL. */
export async function startSocialLink(
	headers: Headers,
	provider: SocialAuthProvider,
	callbackURL = '/dashboard/account'
): Promise<string | null> {
	if (!isProviderEnabled(provider)) return null;

	const safeCallback = callbackURL.startsWith('/') ? callbackURL : '/dashboard/account';
	const result = await auth.api.linkSocialAccount({
		body: {
			provider,
			callbackURL: safeCallback,
			errorCallbackURL: `/dashboard/account?error=${provider}`
		},
		headers
	});

	return result.url ?? null;
}

/** Test helper */
export function resetAuthForTests(): void {
	_auth = null;
}
