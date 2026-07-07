import { describe, expect, it } from 'vitest';
import type { GraphEdge, GraphNode } from '../types/graph';
import { runSimulation } from './static-analysis';

let seq = 0;
function node(componentId: string, overrides: Partial<GraphNode> = {}): GraphNode {
	return {
		id: overrides.id ?? `${componentId}-${seq++}`,
		componentId,
		category: 'compute',
		maxQPS: 5000,
		latencyMs: 20,
		scalable: true,
		stateful: false,
		replicas: 1,
		...overrides
	};
}

function edge(source: string, target: string, async = false): GraphEdge {
	return { id: `${source}->${target}`, source, target, async };
}

describe('runSimulation (static analysis, ported)', () => {
	it('routes all traffic through a linear chain', () => {
		const nodes = [
			node('load-balancer', { id: 'lb', maxQPS: 1_000_000, latencyMs: 1 }),
			node('app-server', { id: 'app', maxQPS: 5000, latencyMs: 20 }),
			node('sql-db', { id: 'db', maxQPS: 10_000, latencyMs: 8 })
		];
		const edges = [edge('lb', 'app'), edge('app', 'db')];
		const result = runSimulation(nodes, edges, 1000);

		expect(result.nodeMetrics.get('lb')!.incomingQPS).toBe(1000);
		expect(result.nodeMetrics.get('app')!.incomingQPS).toBe(1000);
		expect(result.nodeMetrics.get('db')!.incomingQPS).toBe(1000);
		expect(result.throughput).toBe(1000);
		expect(result.bottleneckNodes).toEqual([]);
	});

	it('splits traffic evenly across load-balancer children but fans out from other nodes', () => {
		const nodes = [
			node('load-balancer', { id: 'lb', maxQPS: 1_000_000 }),
			node('app-server', { id: 'app1' }),
			node('app-server', { id: 'app2' }),
			node('sql-db', { id: 'db', maxQPS: 10_000 })
		];
		const edges = [edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'db'), edge('app2', 'db')];
		const result = runSimulation(nodes, edges, 4000);

		expect(result.nodeMetrics.get('app1')!.incomingQPS).toBe(2000);
		expect(result.nodeMetrics.get('app2')!.incomingQPS).toBe(2000);

		expect(result.nodeMetrics.get('db')!.incomingQPS).toBe(4000);
	});

	it('never reports throughput above offered load and detects bottlenecks', () => {
		const nodes = [
			node('app-server', { id: 'app', maxQPS: 500 }),
			node('sql-db', { id: 'db', maxQPS: 10_000 })
		];
		const result = runSimulation(nodes, [edge('app', 'db')], 5000);

		expect(result.bottleneckNodes).toContain('app');
		expect(result.throughput).toBeLessThanOrEqual(5000);
		expect(result.throughput).toBe(500);
		expect(result.nodeMetrics.get('app')!.status).toBe('critical');
	});

	it('treats disconnected nodes as idle, not as traffic entry points', () => {
		const nodes = [
			node('app-server', { id: 'app' }),
			node('sql-db', { id: 'db' }),
			node('cache', { id: 'lonely' })
		];
		const result = runSimulation(nodes, [edge('app', 'db')], 1000);

		expect(result.nodeMetrics.get('lonely')!.status).toBe('idle');
		expect(result.nodeMetrics.get('lonely')!.incomingQPS).toBe(0);
		expect(result.nodeMetrics.get('app')!.incomingQPS).toBe(1000);
	});

	it('excludes async edges from user-facing latency', () => {
		const nodes = [
			node('app-server', { id: 'app', latencyMs: 20 }),
			node('message-queue', { id: 'queue', latencyMs: 500 }),
			node('sql-db', { id: 'db', latencyMs: 8 })
		];
		const edges = [edge('app', 'db'), edge('app', 'queue', true)];
		const result = runSimulation(nodes, edges, 100);

		expect(result.totalLatencyMs).toBe(28);
	});

	it('multiplies capacity by replicas', () => {
		const nodes = [node('app-server', { id: 'app', maxQPS: 1000, replicas: 4 })];
		const result = runSimulation(nodes, [], 3000);

		expect(result.nodeMetrics.get('app')!.effectiveQPS).toBe(4000);
		expect(result.nodeMetrics.get('app')!.status).toBe('warning');
	});

	it('skips edges referencing unknown nodes', () => {
		const nodes = [node('app-server', { id: 'app' }), node('sql-db', { id: 'db' })];
		const edges = [edge('app', 'db'), edge('app', 'ghost'), edge('ghost', 'db')];
		const result = runSimulation(nodes, edges, 100);

		expect(result.nodeMetrics.get('db')!.incomingQPS).toBe(100);
		expect(result.warnings).toEqual([]);
	});

	it('detects cycles, keeps processing, and warns', () => {
		const nodes = [
			node('app-server', { id: 'a' }),
			node('app-server', { id: 'b' }),
			node('app-server', { id: 'c' })
		];
		const edges = [edge('a', 'b'), edge('b', 'c'), edge('c', 'b')];
		const result = runSimulation(nodes, edges, 100);

		expect(result.warnings.some((w) => w.includes('Cycle detected'))).toBe(true);
		for (const id of ['a', 'b', 'c']) {
			expect(result.nodeMetrics.has(id)).toBe(true);
		}
	});

	it('sanitizes invalid maxQPS/replicas and black-holes zero-capacity nodes', () => {
		const nodes = [
			node('app-server', { id: 'app', maxQPS: NaN, replicas: -3 }),
			node('sql-db', { id: 'db' })
		];
		const result = runSimulation(nodes, [edge('app', 'db')], 100);

		const app = result.nodeMetrics.get('app')!;
		expect(app.effectiveQPS).toBe(0);
		expect(app.utilization).toBe(2);
		expect(app.status).toBe('critical');
	});
});
