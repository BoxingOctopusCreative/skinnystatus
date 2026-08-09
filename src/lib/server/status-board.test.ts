import { describe, expect, it } from 'vitest';
import { publicIncidentFields, publicPageFields } from './status-board';
import { DEFAULT_PAGE_THEME } from '$lib/theme-config';
import type { StatusPageInfo } from '$lib/publishing';
import type { IncidentRow } from './db/queries';

/**
 * Whatever these return is serialized into the status page for any visitor to
 * read. The assertions pin the exact key sets so a future `...row` spread can't
 * quietly put check URLs, probe targets, or team ids back on the wire.
 */

const page: StatusPageInfo = {
	id: 'page-1',
	slug: 'acme',
	name: 'Acme Status',
	description: 'Acme service health',
	publishMode: 'path',
	hostProvider: 'vercel',
	publishBaseDomain: 'status.acme.com',
	publishPathPrefix: 's',
	teamId: 'team-secret-1',
	theme: DEFAULT_PAGE_THEME,
	deployUrl: 'https://acme-status.vercel.app',
	deployProviderId: 'prj_internal_abc123',
	lastDeployedAt: new Date('2026-07-01T00:00:00Z'),
	lastDeployError: 'token rejected by provider',
	published: true,
	checkDetailsEnabled: true,
	checkDetailsIncludeErrors: false,
	deletedAt: null
};

const incident: IncidentRow = {
	id: 'inc-1',
	statusPageId: 'page-1',
	title: 'Checkout latency',
	status: 'resolved',
	impact: 'minor',
	createdAt: new Date('2026-07-01T00:00:00Z'),
	updatedAt: new Date('2026-07-01T02:00:00Z'),
	resolvedAt: new Date('2026-07-01T02:00:00Z')
};

describe('publicPageFields', () => {
	it('returns only the fields the status page renders', () => {
		expect(Object.keys(publicPageFields(page)).sort()).toEqual([
			'checkDetailsEnabled',
			'description',
			'name',
			'slug'
		]);
	});

	it('withholds deploy, team, and publishing internals', () => {
		const serialized = JSON.stringify(publicPageFields(page));
		expect(serialized).not.toContain('team-secret-1');
		expect(serialized).not.toContain('prj_internal_abc123');
		expect(serialized).not.toContain('token rejected by provider');
		expect(serialized).not.toContain('checkDetailsIncludeErrors');
	});
});

describe('publicIncidentFields', () => {
	it('returns only the fields the status page renders', () => {
		expect(Object.keys(publicIncidentFields(incident)).sort()).toEqual([
			'createdAt',
			'id',
			'impact',
			'resolvedAt',
			'status',
			'title',
			'updatedAt'
		]);
	});

	it('withholds the owning page id', () => {
		expect(publicIncidentFields(incident)).not.toHaveProperty('statusPageId');
	});
});
