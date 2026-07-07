import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';

const SQLITE_PATH = process.env.SQLITE_PATH ?? 'data/designs.db';
const url = process.env.DATABASE_URL ?? 'postgres://archsim:archsim@localhost:5432/archsim';

const lite = new DatabaseSync(SQLITE_PATH);
const sql = postgres(url, { max: 2, onnotice: () => {} });

await sql`CREATE TABLE IF NOT EXISTS designs (
	id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'generic',
	doc JSONB NOT NULL, schema_version INTEGER NOT NULL, owner_key TEXT NOT NULL,
	created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;
await sql`CREATE TABLE IF NOT EXISTS shares (
	slug TEXT PRIMARY KEY,
	design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
	created_at TEXT NOT NULL)`;

const designs = lite.prepare('SELECT * FROM designs').all();
let migrated = 0;
for (const d of designs) {
	const result = await sql`
		INSERT INTO designs (id, name, provider, doc, schema_version, owner_key, created_at, updated_at)
		VALUES (${d.id}, ${d.name}, ${d.provider}, ${sql.json(JSON.parse(d.doc))},
			${d.schema_version}, ${d.owner_key}, ${d.created_at}, ${d.updated_at})
		ON CONFLICT (id) DO NOTHING`;
	migrated += result.count;
}

const shares = lite.prepare('SELECT * FROM shares').all();
let sharesMigrated = 0;
for (const s of shares) {
	const result = await sql`
		INSERT INTO shares (slug, design_id, created_at)
		VALUES (${s.slug}, ${s.design_id}, ${s.created_at})
		ON CONFLICT (slug) DO NOTHING`;
	sharesMigrated += result.count;
}

const total = await sql`SELECT COUNT(*)::int AS c FROM designs`;
console.log(
	`migrated ${migrated}/${designs.length} designs, ${sharesMigrated}/${shares.length} shares - postgres now holds ${total[0].c} designs`
);
await sql.end();
