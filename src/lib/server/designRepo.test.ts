import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import {
	createDesign,
	deleteDesign,
	getDesign,
	getSharedDesign,
	listDesigns,
	newId,
	newSlug,
	shareDesign,
	updateDesign
} from './designRepo';
import type { DesignDoc } from '$lib/types/graph';
import { migrate, type Sql } from './db';

const url = process.env.TEST_DATABASE_URL;

function makeDoc(name = 'Test design'): DesignDoc {
	const now = new Date().toISOString();
	return {
		schemaVersion: 1,
		id: newId(),
		name,
		provider: 'aws',
		nodes: [
			{
				id: 'n1',
				componentId: 'app-server',
				label: 'Ünïcode λabel - “quotes” ✓',
				position: { x: 1, y: 2 },
				config: { replicas: 3 }
			}
		],
		edges: [],
		groups: [],
		meta: { createdAt: now, updatedAt: now }
	};
}

describe.skipIf(!url)('designRepo (postgres)', () => {
	let sql: Sql;
	const owner = 'a'.repeat(32);
	const stranger = 'b'.repeat(32);
	const schema = `archsim_test_${Math.floor(Math.random() * 1e9)}`;

	beforeAll(async () => {
		sql = postgres(url!, { max: 2, onnotice: () => {} });
		await sql.unsafe(`CREATE SCHEMA ${schema}`);
		await sql.unsafe(`SET search_path TO ${schema}`);
		await migrate(sql);
	});

	afterAll(async () => {
		await sql.unsafe(`DROP SCHEMA ${schema} CASCADE`);
		await sql.end();
	});

	beforeEach(async () => {
		await sql.unsafe(`SET search_path TO ${schema}`);
		await sql`DELETE FROM shares`.catch(() => {});
		await sql`DELETE FROM designs`.catch(() => {});
	});

	it('creates, lists, gets, updates, deletes - with JSONB unicode round-trip', async () => {
		const doc = makeDoc();
		await createDesign(sql, doc, owner);

		expect(await listDesigns(sql, owner)).toHaveLength(1);
		const fetched = await getDesign(sql, doc.id, owner);
		expect(fetched?.name).toBe('Test design');
		expect(fetched?.nodes[0].label).toBe('Ünïcode λabel - “quotes” ✓');
		expect(fetched?.nodes[0].config.replicas).toBe(3);

		const updated = {
			...doc,
			name: 'Renamed',
			meta: { ...doc.meta, updatedAt: new Date().toISOString() }
		};
		expect(await updateDesign(sql, updated, owner)).toBe(true);
		expect((await getDesign(sql, doc.id, owner))?.name).toBe('Renamed');

		expect(await deleteDesign(sql, doc.id, owner)).toBe(true);
		expect(await listDesigns(sql, owner)).toHaveLength(0);
	});

	it('scopes all operations to the owner key', async () => {
		const doc = makeDoc();
		await createDesign(sql, doc, owner);

		expect(await getDesign(sql, doc.id, stranger)).toBeNull();
		expect(await listDesigns(sql, stranger)).toHaveLength(0);
		expect(await updateDesign(sql, doc, stranger)).toBe(false);
		expect(await deleteDesign(sql, doc.id, stranger)).toBe(false);
		expect(await shareDesign(sql, doc.id, stranger)).toBeNull();
	});

	it('share mints a stable slug readable by anyone; cascade delete kills it', async () => {
		const doc = makeDoc();
		await createDesign(sql, doc, owner);

		const slug = await shareDesign(sql, doc.id, owner);
		expect(slug).toBeTruthy();
		expect(await shareDesign(sql, doc.id, owner)).toBe(slug);
		expect((await getSharedDesign(sql, slug!))?.id).toBe(doc.id);
		expect(await getSharedDesign(sql, 'nonexistent')).toBeNull();

		await deleteDesign(sql, doc.id, owner);
		expect(await getSharedDesign(sql, slug!)).toBeNull();
	});
});

describe('slug generation (no db needed)', () => {
	it('uses the unambiguous alphabet', () => {
		for (let i = 0; i < 20; i++) {
			expect(newSlug()).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]{10}$/);
		}
	});
});
