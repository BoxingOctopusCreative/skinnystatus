import { describe, expect, it } from 'vitest';
import {
	PLAN_IDS,
	PLANS,
	formatPlanPrice,
	getPlan,
	isPlanId
} from '$lib/plans';

describe('plans catalog', () => {
	it('includes free through platinum with expected limits', () => {
		expect(PLAN_IDS).toEqual(['free', 'bronze', 'silver', 'gold', 'platinum']);
		expect(PLANS.free).toMatchObject({
			priceCad: 0,
			maxTeams: 1,
			maxStatusPagesPerTeam: 2,
			maxServicesPerStatusPage: 3,
			sso: false
		});
		expect(PLANS.bronze).toMatchObject({
			priceCad: 3,
			maxTeams: 1,
			maxStatusPagesPerTeam: 3,
			maxServicesPerStatusPage: 5
		});
		expect(PLANS.silver).toMatchObject({
			priceCad: 5,
			maxTeams: 2,
			maxStatusPagesPerTeam: 5,
			maxServicesPerStatusPage: 10
		});
		expect(PLANS.gold).toMatchObject({
			priceCad: 9,
			maxTeams: 5,
			maxStatusPagesPerTeam: 10,
			maxServicesPerStatusPage: 10
		});
		expect(PLANS.platinum).toMatchObject({
			priceCad: 20,
			maxTeams: 10,
			maxStatusPagesPerTeam: 20,
			maxServicesPerStatusPage: 20,
			sso: true
		});
	});

	it('getPlan falls back to free for unknown ids', () => {
		expect(getPlan('nope').id).toBe('free');
		expect(getPlan(null).id).toBe('free');
		expect(isPlanId('gold')).toBe(true);
		expect(isPlanId('enterprise')).toBe(false);
	});

	it('formats CAD monthly prices', () => {
		expect(formatPlanPrice(PLANS.free)).toBe('$0 CAD/mo');
		expect(formatPlanPrice(PLANS.platinum)).toBe('$20 CAD/mo');
	});
});
