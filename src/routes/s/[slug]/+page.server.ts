import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSql } from '$lib/server/db';
import { getSharedDesign } from '$lib/server/designRepo';

export const load: PageServerLoad = async ({ params }) => {
	const doc = await getSharedDesign(getSql(), params.slug);
	if (!doc) error(404, 'Shared design not found');
	return { doc };
};
