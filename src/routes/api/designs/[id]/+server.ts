import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSql } from '$lib/server/db';
import { deleteDesign, getDesign, updateDesign } from '$lib/server/designRepo';
import { validateDesignDoc } from '$lib/types/graph';

export const GET: RequestHandler = async ({ params, locals }) => {
	const doc = await getDesign(getSql(), params.id, locals.ownerKey);
	if (!doc) return json({ error: 'not found' }, { status: 404 });
	return json(doc);
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const body = await request.json().catch(() => null);
	const result = validateDesignDoc(body);
	if (!result.ok) return json({ error: result.error }, { status: 400 });
	if (result.doc.id !== params.id) return json({ error: 'id mismatch' }, { status: 400 });

	const previous = await getDesign(getSql(), params.id, locals.ownerKey);
	if (!previous) return json({ error: 'not found' }, { status: 404 });

	const doc = {
		...result.doc,
		meta: {
			...result.doc.meta,
			createdAt: previous.meta.createdAt,
			updatedAt: new Date().toISOString()
		}
	};
	await updateDesign(getSql(), doc, locals.ownerKey);
	return json({ updatedAt: doc.meta.updatedAt, previousUpdatedAt: previous.meta.updatedAt });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const deleted = await deleteDesign(getSql(), params.id, locals.ownerKey);
	if (!deleted) return json({ error: 'not found' }, { status: 404 });
	return json({ ok: true });
};
