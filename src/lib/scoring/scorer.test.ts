import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '../types/graph';
import { getComponentById } from '../catalog/components';
import { scoreDesign } from './scorer';

function node(componentId: string, id: string, replicas = 1): GraphNode {
	const spec = getComponentById(componentId);
	if (!spec) throw new Error(`unknown component ${componentId}`);
	return {
		id,
		componentId,
		category: spec.category,
		maxQPS: spec.maxQPS,
		latencyMs: spec.latencyMs,
		scalable: spec.scalable,
		stateful: spec.stateful,
		replicas
	};
}

function edge(source: string, target: string, async = false): GraphEdge {
	return { id: `${source}->${target}`, source, target, async };
}

function goodDesign(): { nodes: GraphNode[]; edges: GraphEdge[] } {
	const nodes = [
		node('dns', 'dns'),
		node('cdn', 'cdn'),
		node('load-balancer', 'lb'),
		node('api-gateway', 'gw'),
		node('app-server', 'app1'),
		node('app-server', 'app2'),
		node('auth-service', 'auth'),
		node('cache', 'cache'),
		node('sql-db', 'db', 2),
		node('message-queue', 'queue'),
		node('monitoring', 'mon')
	];
	const edges = [
		edge('dns', 'cdn'),
		edge('cdn', 'lb'),
		edge('lb', 'gw'),
		edge('gw', 'app1'),
		edge('gw', 'app2'),
		edge('app1', 'auth'),
		edge('app1', 'cache'),
		edge('app1', 'db'),
		edge('app2', 'cache'),
		edge('app2', 'db'),
		edge('app1', 'queue', true),
		edge('app1', 'mon', true)
	];
	return { nodes, edges };
}

describe('scoreDesign (ported)', () => {
	it('returns zero for an empty canvas', () => {
		const result = scoreDesign([], []);
		expect(result.total).toBe(0);
		expect(result.verdict).toBe('Empty Canvas');
	});

	it('every category maxes at exactly 20', () => {
		const { nodes, edges } = goodDesign();
		const result = scoreDesign(nodes, edges);
		expect(result.categories).toHaveLength(5);
		for (const c of result.categories) {
			expect(c.maxScore).toBe(20);
			expect(c.score).toBeGreaterThanOrEqual(0);
			expect(c.score).toBeLessThanOrEqual(20);
		}
		expect(result.total).toBe(result.categories.reduce((s, c) => s + c.score, 0));
	});

	it('scores a well-rounded design highly', () => {
		const { nodes, edges } = goodDesign();
		const result = scoreDesign(nodes, edges);
		expect(result.total).toBeGreaterThanOrEqual(86);
	});

	it('gives no presence points for disconnected components', () => {
		const { nodes } = goodDesign();
		const wired = scoreDesign(...(Object.values(goodDesign()) as [GraphNode[], GraphEdge[]]));
		const unwired = scoreDesign(nodes, []);
		expect(unwired.total).toBeLessThan(wired.total);

		const scalability = unwired.categories.find((c) => c.category === 'Scalability')!;
		expect(scalability.feedback.some((f) => f.includes("isn't connected"))).toBe(true);
	});

	it('single-node canvas treats the lone node as reachable', () => {
		const result = scoreDesign([node('app-server', 'app')], []);
		const scalability = result.categories.find((c) => c.category === 'Scalability')!;

		expect(scalability.passed.some((p) => p.includes('scalable compute layer'))).toBe(true);
		expect(scalability.score).toBeGreaterThan(0);
	});
});
