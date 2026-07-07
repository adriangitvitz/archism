import type { PageServerLoad } from './$types';
import { getSql } from '$lib/server/db';
import { listDesigns } from '$lib/server/designRepo';

export const load: PageServerLoad = async ({ locals }) => {
	return { designs: await listDesigns(getSql(), locals.ownerKey) };
};
