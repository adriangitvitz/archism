CREATE TABLE designs (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	provider TEXT NOT NULL DEFAULT 'generic',
	doc TEXT NOT NULL,
	schema_version INTEGER NOT NULL,
	owner_key TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX idx_designs_owner ON designs(owner_key);

CREATE TABLE shares (
	slug TEXT PRIMARY KEY,
	design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
	created_at TEXT NOT NULL
);

CREATE INDEX idx_shares_design ON shares(design_id);
