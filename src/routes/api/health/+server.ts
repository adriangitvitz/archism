import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSql, ready } from '$lib/server/db';

export const GET: RequestHandler = async () => {
	try {
		await ready();
		await getSql()`SELECT 1`;
		return json({ ok: true });
	} catch (err) {
		return json(
			{ ok: false, error: err instanceof Error ? err.message : 'db unreachable' },
			{ status: 503 }
		);
	}
};
