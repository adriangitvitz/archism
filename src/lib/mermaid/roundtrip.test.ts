import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { DesignDoc, DesignEdge, DesignNode } from '$lib/types/graph';
import { parseMermaid } from './parse';
import { serializeDoc } from './serialize';
import { SYSTEM_COMPONENTS } from '$lib/catalog/components';

function doc(
	nodes: DesignNode[],
	edges: DesignEdge[],
	groups: DesignDoc['groups'] = []
): DesignDoc {
	return {
		schemaVersion: 1,
		id: 'test-id',
		name: 'Round trip',
		provider: 'aws',
		nodes,
		edges,
		groups,
		meta: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
	};
}

describe('mermaid round-trip', () => {
	it('serialize -> parse preserves the design (modulo doc id/meta)', () => {
		const original = doc(
			[
				{
					id: 'lb-1',
					componentId: 'load-balancer',
					label: 'Load Balancer',
					position: { x: 10, y: 200 },
					config: { replicas: 2 }
				},
				{
					id: 'app-1',
					componentId: 'app-server',
					label: 'App [primary]',
					position: { x: 270, y: 100 },
					groupId: 'vpc',
					config: { autoscale: true, maxQPSOverride: 9000 }
				},
				{
					id: 'topic-1',
					componentId: 'pub-sub',
					label: 'events',
					position: { x: 530, y: 300 },
					config: { pubsub: { role: 'topic', partitions: 4, backpressure: true } }
				}
			],
			[
				{ id: 'e1', source: 'lb-1', target: 'app-1', kind: 'sync', protocol: 'HTTP' },
				{
					id: 'e2',
					source: 'app-1',
					target: 'topic-1',
					kind: 'pubsub',
					label: 'publish',
					ports: { sourceSide: 'B', targetSide: 'T' }
				}
			],
			[{ id: 'vpc', label: 'VPC us-east' }]
		);

		const text = serializeDoc(original);
		const result = parseMermaid(text);
		expect(result.errors).toEqual([]);
		expect(result.doc).not.toBeNull();

		const parsed = result.doc!;
		expect(parsed.name).toBe(original.name);
		expect(parsed.provider).toBe(original.provider);
		expect(parsed.groups).toHaveLength(1);
		expect(parsed.groups[0].label).toBe('VPC us-east');

		const byId = new Map(parsed.nodes.map((n) => [n.id, n]));
		for (const n of original.nodes) {
			const p = byId.get(n.id)!;
			expect(p, `node ${n.id}`).toBeDefined();
			expect(p.componentId).toBe(n.componentId);
			expect(p.position).toEqual(n.position);
			expect(p.config).toEqual(n.config);
			expect(p.groupId).toBe(n.groupId);
		}
		const edgeById = new Map(parsed.edges.map((e) => [e.id, e]));
		for (const e of original.edges) {
			const p = edgeById.get(e.id)!;
			expect(p, `edge ${e.id}`).toBeDefined();
			expect(p.source).toBe(e.source);
			expect(p.target).toBe(e.target);
			expect(p.kind).toBe(e.kind);
			expect(p.label).toBe(e.label);
			expect(p.protocol).toBe(e.protocol);
		}

		expect(edgeById.get('e2')!.ports).toEqual({ sourceSide: 'B', targetSide: 'T' });
	});

	it('serializer is canonical: serialize(parse(serialize(d))) === serialize(d)', () => {
		const original = doc(
			[
				{ id: 'a', componentId: 'app-server', label: 'A', position: { x: 0, y: 0 }, config: {} },
				{
					id: 'b',
					componentId: 'sql-db',
					label: 'B',
					position: { x: 260, y: 0 },
					config: { replicas: 3 }
				}
			],
			[{ id: 'a->b', source: 'a', target: 'b', kind: 'sync' }]
		);
		const once = serializeDoc(original);
		const reparsed = parseMermaid(once).doc!;
		const twice = serializeDoc({ ...reparsed, id: 'x', meta: original.meta });
		expect(twice).toBe(once);
	});

	it('property: random designs round-trip losslessly', () => {
		const componentIds = SYSTEM_COMPONENTS.map((c) => c.id);
		const nodeArb = fc
			.record({
				idx: fc.nat({ max: 999 }),
				component: fc.constantFrom(...componentIds),
				label: fc.stringMatching(/^[A-Za-z0-9 _.()-]{1,20}$/),
				x: fc.integer({ min: -2000, max: 2000 }),
				y: fc.integer({ min: -2000, max: 2000 }),
				replicas: fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined })
			})
			.map((r) => ({
				id: `n-${r.idx}`,
				componentId: r.component,
				label: r.label,
				position: { x: r.x, y: r.y },
				config: r.replicas !== undefined ? { replicas: r.replicas } : {}
			}));

		const designArb = fc
			.uniqueArray(nodeArb, { minLength: 1, maxLength: 12, selector: (n) => n.id })
			.chain((nodes) =>
				fc
					.array(
						fc.record({
							s: fc.nat({ max: nodes.length - 1 }),
							t: fc.nat({ max: nodes.length - 1 }),
							kind: fc.constantFrom('sync', 'async', 'pubsub')
						}),
						{ maxLength: 20 }
					)
					.map((pairs) => {
						const seen = new Set<string>();
						const edges: DesignEdge[] = [];
						for (const p of pairs) {
							if (p.s === p.t) continue;
							const id = `e-${p.s}-${p.t}`;
							if (seen.has(id)) continue;
							seen.add(id);
							edges.push({
								id,
								source: nodes[p.s].id,
								target: nodes[p.t].id,
								kind: p.kind as DesignEdge['kind']
							});
						}
						return doc(nodes as DesignNode[], edges);
					})
			);

		fc.assert(
			fc.property(designArb, (d) => {
				const text = serializeDoc(d);
				const result = parseMermaid(text);
				expect(result.errors).toEqual([]);
				const parsed = result.doc!;
				expect(new Set(parsed.nodes.map((n) => n.id))).toEqual(new Set(d.nodes.map((n) => n.id)));
				expect(new Set(parsed.edges.map((e) => e.id))).toEqual(new Set(d.edges.map((e) => e.id)));
				for (const n of d.nodes) {
					const p = parsed.nodes.find((x) => x.id === n.id)!;
					expect(p.componentId).toBe(n.componentId);
					expect(p.position).toEqual(n.position);
					expect(p.config).toEqual(n.config);
				}

				expect(serializeDoc({ ...parsed, id: d.id, meta: d.meta })).toBe(text);
			}),
			{ numRuns: 50 }
		);
	});

	it('parses foreign mermaid without @meta using icon fallbacks + auto layout', () => {
		const text = `architecture-beta
  group api(cloud)[API]
  service db(database)[Database] in api
  service disk1(disk)[Storage] in api
  service server(server)[Server] in api
  db:R --> L:server
  server:B --> T:disk1
`;
		const result = parseMermaid(text);
		expect(result.errors).toEqual([]);
		const parsed = result.doc!;
		expect(parsed.nodes).toHaveLength(3);
		expect(parsed.nodes.find((n) => n.id === 'db')!.componentId).toBe('sql-db');
		expect(parsed.nodes.find((n) => n.id === 'server')!.componentId).toBe('app-server');
		expect(parsed.nodes.find((n) => n.id === 'disk1')!.componentId).toBe('object-storage');

		expect(parsed.nodes.some((n) => n.position.x !== 0 || n.position.y !== 0)).toBe(true);
		expect(parsed.groups).toHaveLength(1);
	});

	it('reports per-line errors but keeps parsing', () => {
		const text = `architecture-beta
  service ok(server)[Fine]
  this is garbage
  service ok2(server)[Also fine]
  ok:R --> L:missing
`;
		const result = parseMermaid(text);
		expect(result.doc!.nodes).toHaveLength(2);
		expect(result.errors).toHaveLength(2);
		expect(result.errors[0].line).toBe(3);
		expect(result.errors[1].line).toBe(5);
	});

	it('never throws on garbage input', () => {
		fc.assert(
			fc.property(fc.string({ maxLength: 500 }), (s) => {
				expect(() => parseMermaid(s)).not.toThrow();
			}),
			{ numRuns: 200 }
		);
	});
});
