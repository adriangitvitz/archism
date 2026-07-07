import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSql } from '$lib/server/db';
import { getDesign } from '$lib/server/designRepo';

export const load: PageServerLoad = async ({ params, locals }) => {
	const doc = await getDesign(getSql(), params.id, locals.ownerKey);
	if (!doc) error(404, 'Design not found');
	return { doc };
};
