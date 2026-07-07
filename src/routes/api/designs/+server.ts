import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSql } from '$lib/server/db';
import { createDesign, listDesigns, newId } from '$lib/server/designRepo';
import type { DesignDoc } from '$lib/types/graph';
import { validateDesignDoc } from '$lib/types/graph';
import type { Provider } from '$lib/types/provider';

export const GET: RequestHandler = async ({ locals }) => {
	return json(await listDesigns(getSql(), locals.ownerKey));
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	const now = new Date().toISOString();

	let doc: DesignDoc;
	if (Array.isArray(body.nodes)) {
		const candidate = { ...body, id: newId(), meta: { createdAt: now, updatedAt: now } };
		const result = validateDesignDoc(candidate);
		if (!result.ok) return json({ error: result.error }, { status: 400 });
		doc = result.doc;
	} else {
		doc = {
			schemaVersion: 1,
			id: newId(),
			name:
				typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled design',
			provider: (body.provider as Provider) || 'generic',
			nodes: [],
			edges: [],
			groups: [],
			meta: { createdAt: now, updatedAt: now }
		};
		const result = validateDesignDoc(doc);
		if (!result.ok) return json({ error: result.error }, { status: 400 });
	}

	await createDesign(getSql(), doc, locals.ownerKey);
	return json({ id: doc.id }, { status: 201 });
};
