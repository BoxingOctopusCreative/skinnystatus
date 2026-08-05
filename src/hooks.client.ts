import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { dev } from '$app/environment';

const dsn = env.PUBLIC_SENTRY_DSN;

Sentry.init({
	dsn,
	environment: env.PUBLIC_SENTRY_ENVIRONMENT ?? (dev ? 'development' : 'production'),
	release: env.PUBLIC_SENTRY_RELEASE,
	tracesSampleRate: dev ? 1.0 : 0.1,
	integrations: [
		Sentry.replayIntegration({
			maskAllText: true,
			blockAllMedia: true
		})
	],
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,
	enableLogs: true
});

export const handleError = Sentry.handleErrorWithSentry();
