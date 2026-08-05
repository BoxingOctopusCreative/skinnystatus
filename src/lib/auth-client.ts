import { createAuthClient } from 'better-auth/client';
import { usernameClient, twoFactorClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
	plugins: [usernameClient(), twoFactorClient(), passkeyClient()]
});
