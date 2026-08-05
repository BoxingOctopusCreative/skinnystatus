import * as Sentry from '@sentry/sveltekit';
import { initConfig } from '$lib/server/config';

// Infisical (and .env) must load before Sentry.init so /sentry secrets are available.
await initConfig();

const dsn = process.env.SENTRY_DSN ?? process.env.PUBLIC_SENTRY_DSN;

Sentry.init({
	dsn,
	environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
	release: process.env.SENTRY_RELEASE,
	tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
	enableLogs: true
});
