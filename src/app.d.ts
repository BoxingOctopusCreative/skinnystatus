import type { User, Session } from 'better-auth';
import type { StatusPageInfo } from '$lib/publishing';

declare global {
	namespace App {
		interface Locals {
			user?: User;
			session?: Session;
			statusPage: StatusPageInfo | null;
		}
	}
}

export {};
