import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseMermaid } from './parse';

const CORPUS_DIRS = [
	'/Users/adriannajera/Labs/tmconsulting/docs',
	'/Users/adriannajera/Projects/forefront'
];

const SUPPORTED_HEADERS = /^(architecture-beta|flowchart|graph)\b/;

function extractMermaidBlocks(markdown: string): string[] {
	const blocks: string[] = [];
	const re = /```mermaid\n([\s\S]*?)```/g;
	for (const match of markdown.matchAll(re)) blocks.push(match[1]);
	return blocks;
}

function diagramType(block: string): string {
	for (const rawLine of block.split('\n')) {
		const line = rawLine.trim();
		if (line && !line.startsWith('%%')) return line.split(/[\s;]/)[0];
	}
	return '(empty)';
}

function collectMarkdownFiles(dir: string, depth = 0): string[] {
	if (depth > 2) return [];
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name.includes('venv'))
			continue;
		const path = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...collectMarkdownFiles(path, depth + 1));
		else if (entry.name.endsWith('.md') || entry.name.endsWith('.mmd')) out.push(path);
	}
	return out;
}

const TMCONSULTING_FLOW = `flowchart TD
    SCH[Cloud Scheduler<br/>cada 15 min, OIDC]
    SCH -->|POST /run| CR[Cloud Run<br/>caso de uso del ciclo]

    SM[(Secret Manager<br/>creds aSa y SAP)] -.-> CR

    CR --> ASA[Adaptador aSa<br/>GET pull viajes]
    ASA --> CONS[Motor de consolidacion<br/>dominio puro]
    CONS --> DEDUP{Dedup por VIAJE}
    DEDUP -->|ya procesado| SKIP[Omitir viaje]
    DEDUP -->|nuevo| ORD[Cliente OData SAP<br/>deep insert ZOR]
    ORD --> WC[WriteStrategy<br/>ZCONTROLCODE batch]
    WC --> REG[Registrar processed_trips<br/>+ log a BigQuery]

    ASA -->|error de conexion| ERR{Clasificar error}
    ORD -->|fallo| ERR
    WC -->|fallo parcial| ERR
    ERR -->|reprocesable tecnico| RPQ[(Reprocess queue<br/>PostgreSQL)]
    ERR -->|dato comercial| MAN[Revision manual<br/>+ notificacion]

    DEDUP -.->|consulta verdad| SAP[(SAP S/4HANA<br/>ZCONTROLCODE)]
    WC --> SAP
    ORD --> SAP
    REG --> PG[(PostgreSQL / Cloud SQL<br/>processed_trips, reprocess)]
    REG --> BQ[(BigQuery<br/>trazabilidad por viaje)]
`;

const FOREFRONT_FLOW = `flowchart TD
    user["RCM / Director / VP / FPA"]
    subgraph ui["Goal Setting tab"]
        fb["Filter bar (RCM, Clinician)"]
        ttm["TTM panel (read-only)"]
        bp["2027 Budget panel (editable)"]
    end
    subgraph api["API /api/v1"]
        a1["GET /rcms"]
        a3["POST / DELETE /override"]
    end
    subgraph db["PostgreSQL"]
        clin[("clinicians")]
        ov[("overrides")]
    end

    user --> fb
    fb -->|"READ"| a1 -->|"READ"| clin
    bp -->|"WRITE"| a3 -->|"WRITE"| ov
`;

describe('mermaid corpus - vendored fixtures', () => {
	it('imports the tmconsulting pipeline flowchart', () => {
		const result = parseMermaid(TMCONSULTING_FLOW);
		expect(result.errors).toEqual([]);
		const doc = result.doc!;
		expect(doc.nodes.length).toBe(16);
		expect(doc.edges.length).toBe(19);

		const byId = new Map(doc.nodes.map((n) => [n.id, n]));

		expect(byId.get('SCH')!.componentId).toBe('task-scheduler');
		expect(byId.get('SM')!.componentId).toBe('config-service');
		expect(byId.get('PG')!.componentId).toBe('sql-db');
		expect(byId.get('BQ')!.componentId).toBe('data-warehouse');
		expect(byId.get('RPQ')!.componentId).toBe('message-queue');

		expect(byId.get('DEDUP')!.componentId).toBe('custom');

		const dotted = doc.edges.find((e) => e.source === 'SM' && e.target === 'CR')!;
		expect(dotted.kind).toBe('async');

		expect(byId.get('CR')!.label).toBe('Cloud Run caso de uso del ciclo');

		expect(doc.nodes.some((n) => n.position.x !== 0 || n.position.y !== 0)).toBe(true);
	});

	it('imports the forefront tab flowchart with subgraphs and chains', () => {
		const result = parseMermaid(FOREFRONT_FLOW);
		expect(result.errors).toEqual([]);
		const doc = result.doc!;
		expect(doc.groups.map((g) => g.id).sort()).toEqual(['api', 'db', 'ui']);
		const byId = new Map(doc.nodes.map((n) => [n.id, n]));
		expect(byId.get('fb')!.groupId).toBe('ui');
		expect(byId.get('clin')!.groupId).toBe('db');
		expect(byId.get('clin')!.componentId).toBe('sql-db');

		const hop1 = doc.edges.find((e) => e.source === 'fb' && e.target === 'a1')!;
		const hop2 = doc.edges.find((e) => e.source === 'a1' && e.target === 'clin')!;
		expect(hop1.label).toBe('READ');
		expect(hop2.label).toBe('READ');
	});

	it('rejects sequence diagrams with one clean error', () => {
		const result = parseMermaid('sequenceDiagram\n  A->>B: hi\n  B-->>A: yo\n');
		expect(result.doc).toBeNull();
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].message).toContain('Unsupported diagram type "sequenceDiagram"');
	});
});

for (const dir of CORPUS_DIRS) {
	describe.skipIf(!existsSync(dir))(`mermaid corpus - live: ${dir}`, () => {
		const cases: Array<{ file: string; index: number; type: string; block: string }> = [];
		if (existsSync(dir)) {
			for (const file of collectMarkdownFiles(dir)) {
				extractMermaidBlocks(readFileSync(file, 'utf8')).forEach((block, index) => {
					cases.push({ file: file.slice(dir.length + 1), index, type: diagramType(block), block });
				});
			}
		}

		it('finds mermaid blocks to test', () => {
			expect(cases.length).toBeGreaterThan(0);
		});

		for (const c of cases) {
			if (SUPPORTED_HEADERS.test(c.type)) {
				it(`imports ${c.file}#${c.index} (${c.type})`, () => {
					const result = parseMermaid(c.block);
					expect(result.errors, JSON.stringify(result.errors)).toEqual([]);
					expect(result.doc).not.toBeNull();
					expect(result.doc!.nodes.length).toBeGreaterThan(0);

					const ids = new Set(result.doc!.nodes.map((n) => n.id));
					for (const e of result.doc!.edges) {
						expect(ids.has(e.source), `edge source ${e.source}`).toBe(true);
						expect(ids.has(e.target), `edge target ${e.target}`).toBe(true);
					}
				});
			} else {
				it(`cleanly rejects ${c.file}#${c.index} (${c.type})`, () => {
					const result = parseMermaid(c.block);
					expect(result.doc).toBeNull();
					expect(result.errors).toHaveLength(1);
					expect(result.errors[0].message).toContain('Unsupported diagram type');
				});
			}
		}
	});
}
