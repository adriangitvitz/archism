import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { ready } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	await ready();
	event.locals.ownerKey = env.OWNER_KEY || 'local';
	return resolve(event);
};
