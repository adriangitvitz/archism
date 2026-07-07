import postgres from 'postgres';
import { env } from '$env/dynamic/private';

export type Sql = postgres.Sql;

const DEFAULT_URL = 'postgres://archsim:archsim@localhost:5432/archsim';

let sql: Sql | null = null;
let migrated: Promise<void> | null = null;

export function getSql(): Sql {
	if (!sql) {
		sql = postgres(env.DATABASE_URL || DEFAULT_URL, {
			max: 10,
			onnotice: () => {}
		});
	}
	return sql;
}

export function ready(): Promise<void> {
	if (!migrated) migrated = migrate(getSql());
	return migrated;
}

export async function migrate(sql: Sql): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS designs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			provider TEXT NOT NULL DEFAULT 'generic',
			doc JSONB NOT NULL,
			schema_version INTEGER NOT NULL,
			owner_key TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_designs_owner ON designs (owner_key)`;
	await sql`
		CREATE TABLE IF NOT EXISTS shares (
			slug TEXT PRIMARY KEY,
			design_id TEXT NOT NULL REFERENCES designs (id) ON DELETE CASCADE,
			created_at TEXT NOT NULL
		)`;
	await sql`CREATE INDEX IF NOT EXISTS idx_shares_design ON shares (design_id)`;
}
