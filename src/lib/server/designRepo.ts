import { randomBytes } from 'node:crypto';
import type { DesignDoc } from '$lib/types/graph';
import type { Provider } from '$lib/types/provider';
import type { Sql } from './db';

export interface DesignSummary {
	id: string;
	name: string;
	provider: Provider;
	createdAt: string;
	updatedAt: string;
}

const SLUG_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newId(): string {
	return crypto.randomUUID();
}

export function newSlug(length = 10): string {
	const bytes = randomBytes(length);
	let slug = '';
	for (let i = 0; i < length; i++) slug += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
	return slug;
}

export async function listDesigns(sql: Sql, ownerKey: string): Promise<DesignSummary[]> {
	const rows = await sql`
		SELECT id, name, provider, created_at, updated_at
		FROM designs WHERE owner_key = ${ownerKey}
		ORDER BY updated_at DESC`;
	return rows.map((r) => ({
		id: r.id as string,
		name: r.name as string,
		provider: r.provider as Provider,
		createdAt: r.created_at as string,
		updatedAt: r.updated_at as string
	}));
}

export async function getDesign(sql: Sql, id: string, ownerKey: string): Promise<DesignDoc | null> {
	const rows = await sql`SELECT doc FROM designs WHERE id = ${id} AND owner_key = ${ownerKey}`;
	return rows.length > 0 ? (rows[0].doc as DesignDoc) : null;
}

export async function createDesign(sql: Sql, doc: DesignDoc, ownerKey: string): Promise<void> {
	await sql`
		INSERT INTO designs (id, name, provider, doc, schema_version, owner_key, created_at, updated_at)
		VALUES (${doc.id}, ${doc.name}, ${doc.provider}, ${sql.json(doc as unknown as postgresJson)},
			${doc.schemaVersion}, ${ownerKey}, ${doc.meta.createdAt}, ${doc.meta.updatedAt})`;
}

export async function updateDesign(sql: Sql, doc: DesignDoc, ownerKey: string): Promise<boolean> {
	const result = await sql`
		UPDATE designs SET
			name = ${doc.name}, provider = ${doc.provider}, doc = ${sql.json(doc as unknown as postgresJson)},
			schema_version = ${doc.schemaVersion}, updated_at = ${doc.meta.updatedAt}
		WHERE id = ${doc.id} AND owner_key = ${ownerKey}`;
	return result.count > 0;
}

export async function deleteDesign(sql: Sql, id: string, ownerKey: string): Promise<boolean> {
	const result = await sql`DELETE FROM designs WHERE id = ${id} AND owner_key = ${ownerKey}`;
	return result.count > 0;
}

export async function shareDesign(
	sql: Sql,
	designId: string,
	ownerKey: string
): Promise<string | null> {
	const owned = await sql`SELECT 1 FROM designs WHERE id = ${designId} AND owner_key = ${ownerKey}`;
	if (owned.length === 0) return null;
	const existing = await sql`SELECT slug FROM shares WHERE design_id = ${designId}`;
	if (existing.length > 0) return existing[0].slug as string;
	const slug = newSlug();
	await sql`
		INSERT INTO shares (slug, design_id, created_at)
		VALUES (${slug}, ${designId}, ${new Date().toISOString()})`;
	return slug;
}

export async function getSharedDesign(sql: Sql, slug: string): Promise<DesignDoc | null> {
	const rows = await sql`
		SELECT d.doc FROM shares s JOIN designs d ON d.id = s.design_id WHERE s.slug = ${slug}`;
	return rows.length > 0 ? (rows[0].doc as DesignDoc) : null;
}

type postgresJson = Parameters<Sql['json']>[0];
