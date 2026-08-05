import { auth } from '$lib/server/auth';
import { getUserByEmail } from '$lib/server/db/queries';

/** Well-known account for local/testing. Not created in production unless SEED_EXAMPLE_USER=1. */
export const EXAMPLE_USER = {
	email: 'demo@example.com',
	password: 'demo-password',
	name: 'Demo User',
	username: 'demo'
} as const;

let seeded = false;

function shouldSeedExampleUser(): boolean {
	if (process.env.SEED_EXAMPLE_USER === '1' || process.env.SEED_EXAMPLE_USER === 'true') {
		return true;
	}
	return process.env.NODE_ENV !== 'production';
}

/** Ensure demo user exists in non-production (or when SEED_EXAMPLE_USER is set). */
export async function seedOnStartup(): Promise<void> {
	if (seeded) return;
	seeded = true;

	if (!shouldSeedExampleUser()) return;

	const existing = await getUserByEmail(EXAMPLE_USER.email);
	if (existing) return;

	try {
		const result = await auth.api.signUpEmail({
			body: {
				email: EXAMPLE_USER.email,
				password: EXAMPLE_USER.password,
				name: EXAMPLE_USER.name,
				username: EXAMPLE_USER.username
			} as {
				email: string;
				password: string;
				name: string;
				username: string;
			}
		});
		const userId = result.user?.id;
		if (userId) {
			const { ensureDefaultStatusPage, claimOrphanStatusPages } = await import(
				'$lib/server/db/queries'
			);
			await claimOrphanStatusPages(userId);
			await ensureDefaultStatusPage(userId, {
				email: EXAMPLE_USER.email,
				name: EXAMPLE_USER.name
			});
		}
		console.info(
			`[skinnystatus] Seeded example user ${EXAMPLE_USER.email} (password: ${EXAMPLE_USER.password})`
		);
	} catch (error) {
		console.error('[skinnystatus] Failed to seed example user', error);
	}
}
