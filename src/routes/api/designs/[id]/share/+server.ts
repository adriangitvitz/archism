import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSql } from '$lib/server/db';
import { shareDesign } from '$lib/server/designRepo';

export const POST: RequestHandler = async ({ params, locals }) => {
	const slug = await shareDesign(getSql(), params.id, locals.ownerKey);
	if (!slug) return json({ error: 'not found' }, { status: 404 });
	return json({ slug, url: `/s/${slug}` });
};
