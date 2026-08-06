import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db, incident, incidentUpdate, incidentService } from '$lib/server/db';
import {
	listServices,
	listIncidents,
	getIncidentUpdates,
	getIncident,
	toPageInfo
} from '$lib/server/db/queries';
import { resolveAdminPageId, requireMutablePage } from '$lib/server/dashboard-page';
import { canonicalPageUrl } from '$lib/server/publishing';
import { INCIDENT_IMPACTS, INCIDENT_STATUSES } from '$lib/status';
import { notifyIncidentAlert } from '$lib/server/subscriptions';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');
	const { pageId, pages, team, teams } = await resolveAdminPageId(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});
	const current = pages.find((p) => p.id === pageId) ?? pages[0];
	const info = toPageInfo(current);
	const incidents = await listIncidents(pageId, { limit: 50 });
	const services = await listServices(pageId);
	const withUpdates = await Promise.all(
		incidents.map(async (i) => ({
			...i,
			updates: await getIncidentUpdates(i.id)
		}))
	);

	return {
		pages,
		pageId,
		team,
		teams,
		pageUrl: canonicalPageUrl(info),
		incidentPathPrefix: info.publishMode === 'path' ? `/s/${info.slug}` : '',
		incidents: withUpdates,
		services,
		statuses: INCIDENT_STATUSES,
		impacts: INCIDENT_IMPACTS
	};
};

export const actions: Actions = {
	create: async ({ request, url, locals, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const fromForm = form.get('statusPageId')?.toString();
		const pageId = fromForm
			? (await requireMutablePage(fromForm, locals.user.id)).id
			: (await resolveAdminPageId(url, locals.user.id, cookies)).pageId;
		const title = form.get('title')?.toString().trim() ?? '';
		const body = form.get('body')?.toString().trim() ?? '';
		const status = form.get('status')?.toString() || 'investigating';
		const impact = form.get('impact')?.toString() || 'minor';
		const serviceIds = form.getAll('serviceIds').map(String);

		if (!title || !body) return fail(400, { message: 'Title and update body are required' });

		const id = crypto.randomUUID();
		const now = new Date();

		await db.insert(incident).values({
			id,
			statusPageId: pageId,
			title,
			status,
			impact,
			createdAt: now,
			updatedAt: now,
			resolvedAt: status === 'resolved' ? now : null
		});

		await db.insert(incidentUpdate).values({
			incidentId: id,
			body,
			status,
			createdAt: now
		});

		if (serviceIds.length > 0) {
			await db.insert(incidentService).values(
				serviceIds.map((serviceId) => ({ incidentId: id, serviceId }))
			);
		}

		void notifyIncidentAlert({
			statusPageId: pageId,
			incidentTitle: title,
			incidentStatus: status,
			incidentImpact: impact,
			updateBody: body,
			kind: 'created'
		});

		return { success: true };
	},
	addUpdate: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const incidentId = form.get('incidentId')?.toString() ?? '';
		const body = form.get('body')?.toString().trim() ?? '';
		const status = form.get('status')?.toString() || 'investigating';

		if (!incidentId || !body) return fail(400, { message: 'Incident and body are required' });

		const existing = await getIncident(incidentId);
		if (!existing) return fail(404, { message: 'Incident not found' });
		await requireMutablePage(existing.statusPageId, locals.user.id);

		const now = new Date();
		await db.insert(incidentUpdate).values({
			incidentId,
			body,
			status,
			createdAt: now
		});

		await db
			.update(incident)
			.set({
				status,
				updatedAt: now,
				resolvedAt: status === 'resolved' ? now : null
			})
			.where(eq(incident.id, incidentId));

		void notifyIncidentAlert({
			statusPageId: existing.statusPageId,
			incidentTitle: existing.title,
			incidentStatus: status,
			incidentImpact: existing.impact,
			updateBody: body,
			kind: 'updated'
		});

		return { success: true };
	},
	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const existing = await getIncident(id);
		if (!existing) return fail(404, { message: 'Incident not found' });
		await requireMutablePage(existing.statusPageId, locals.user.id);

		await db.delete(incident).where(eq(incident.id, id));
		return { success: true };
	}
};
