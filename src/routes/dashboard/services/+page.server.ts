import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { CHECK_TYPES, checkTypeLabel, DNS_RECORD_TYPES } from '$lib/checks';
import { assertCanCreateService, isLimitError } from '$lib/server/billing/limits';
import { parseCheckFieldsFromForm } from '$lib/server/checks';
import { db, service } from '$lib/server/db';
import { getService, getServiceViews } from '$lib/server/db/queries';
import { resolveAdminPageId, requireMutablePage } from '$lib/server/dashboard-page';
import { SERVICE_STATUSES } from '$lib/status';

export const load: PageServerLoad = async ({ url, locals, cookies }) => {
	if (!locals.user) throw redirect(303, '/dashboard/login');
	const { pageId, pages, team, teams } = await resolveAdminPageId(url, locals.user.id, cookies, {
		email: locals.user.email,
		name: locals.user.name
	});
	return {
		pages,
		pageId,
		team,
		teams,
		services: await getServiceViews(pageId),
		statuses: SERVICE_STATUSES,
		checkTypes: CHECK_TYPES.map((type) => ({ type, label: checkTypeLabel(type) })),
		dnsRecordTypes: DNS_RECORD_TYPES
	};
};

function emptyToNull(value: FormDataEntryValue | null): string | null {
	const s = value?.toString().trim() ?? '';
	return s === '' ? null : s;
}

export const actions: Actions = {
	create: async ({ request, url, locals, cookies }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const fromForm = form.get('statusPageId')?.toString();
		const pageId = fromForm
			? (await requireMutablePage(fromForm, locals.user.id)).id
			: (await resolveAdminPageId(url, locals.user.id, cookies)).pageId;
		const name = form.get('name')?.toString().trim() ?? '';
		if (!name) return fail(400, { message: 'Name is required' });

		const parsed = parseCheckFieldsFromForm(form);
		if (!parsed.ok) return fail(400, { message: parsed.message });

		try {
			await assertCanCreateService(pageId);
		} catch (err) {
			if (isLimitError(err)) {
				return fail(403, { message: err.message, upgrade: true });
			}
			throw err;
		}

		await db.insert(service).values({
			statusPageId: pageId,
			name,
			description: emptyToNull(form.get('description')),
			sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
			checkType: parsed.value.checkType,
			checkUrl: parsed.value.checkUrl,
			expectedStatus: parsed.value.expectedStatus,
			checkConfig: parsed.value.checkConfig,
			manualStatus: emptyToNull(form.get('manualStatus'))
		});

		return { success: true };
	},
	update: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		const name = form.get('name')?.toString().trim() ?? '';
		if (!id || !name) return fail(400, { message: 'ID and name are required' });

		const existing = await getService(id);
		if (!existing) return fail(404, { message: 'Service not found' });
		await requireMutablePage(existing.statusPageId, locals.user.id);

		const parsed = parseCheckFieldsFromForm(form, {
			checkType: existing.checkType,
			checkConfig: existing.checkConfig
		});
		if (!parsed.ok) return fail(400, { message: parsed.message });

		await db
			.update(service)
			.set({
				name,
				description: emptyToNull(form.get('description')),
				sortOrder: Number(form.get('sortOrder') ?? 0) || 0,
				checkType: parsed.value.checkType,
				checkUrl: parsed.value.checkUrl,
				expectedStatus: parsed.value.expectedStatus,
				checkConfig: parsed.value.checkConfig,
				manualStatus: emptyToNull(form.get('manualStatus')),
				updatedAt: new Date()
			})
			.where(eq(service.id, id));

		return { success: true };
	},
	delete: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });
		const form = await request.formData();
		const id = form.get('id')?.toString() ?? '';
		if (!id) return fail(400, { message: 'ID is required' });

		const existing = await getService(id);
		if (!existing) return fail(404, { message: 'Service not found' });
		await requireMutablePage(existing.statusPageId, locals.user.id);

		await db.delete(service).where(eq(service.id, id));
		return { success: true };
	}
};
