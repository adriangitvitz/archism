import { describe, expect, it } from 'vitest';
import { SimEngine } from './engine';
import type { SimConfig, SimEdgeSpec, SimGraphSpec, SimNodeSpec } from './types';

function node(id: string, overrides: Partial<SimNodeSpec> = {}): SimNodeSpec {
	return {
		id,
		componentId: overrides.componentId ?? 'app-server',
		label: id,
		maxQPS: 5000,
		replicas: 1,
		baseLatencyMs: 20,
		routing: 'fanout',
		queueBound: 0,
		timeoutMs: 0,
		...overrides
	};
}

function edge(source: string, target: string, overrides: Partial<SimEdgeSpec> = {}): SimEdgeSpec {
	return { id: `${source}->${target}`, source, target, kind: 'sync', weight: 1, ...overrides };
}

function config(rps: number): SimConfig {
	return { seed: 42, profile: { kind: 'constant', rps }, durationSec: 3600 };
}

function run(engine: SimEngine, ticks: number): void {
	for (let i = 0; i < ticks; i++) engine.tick();
}

describe('error injection', () => {
	it('fails the configured fraction of accepted traffic, conserving flow', () => {
		const engine = new SimEngine(
			{
				nodes: [node('svc'), node('db', { componentId: 'sql-db' })],
				edges: [edge('svc', 'db')],
				topics: []
			},
			config(1000)
		);
		run(engine, 20);
		expect(engine.nodeState('svc')!.errorRate).toBe(0);

		engine.inject_({ type: 'error-inject', nodeId: 'svc', fraction: 0.5, durationSec: 5 });
		run(engine, 20);
		const during = engine.nodeState('svc')!;
		expect(during.errorRate).toBeCloseTo(500, 1);
		expect(during.served).toBeCloseTo(500, 1);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(500, 1);

		run(engine, 60);
		expect(engine.nodeState('svc')!.errorRate).toBe(0);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(1000, 1);
	});
});

describe('network partition', () => {
	it('partitioned fanout links fail at the caller; restore heals', () => {
		const engine = new SimEngine(
			{
				nodes: [node('svc'), node('db', { componentId: 'sql-db' })],
				edges: [edge('svc', 'db')],
				topics: []
			},
			config(1000)
		);
		run(engine, 10);
		engine.inject_({ type: 'partition-edge', edgeId: 'svc->db' });
		run(engine, 10);
		const svc = engine.nodeState('svc')!;
		expect(svc.errorRate).toBeCloseTo(1000, 1);
		expect(engine.nodeState('db')!.inRate).toBe(0);

		engine.inject_({ type: 'restore-edge', edgeId: 'svc->db' });
		run(engine, 10);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(1000, 1);
		const kinds = engine.drainEvents().map((e) => e.kind);
		expect(kinds).toContain('partitioned');
		expect(kinds).toContain('restored');
	});

	it('LBs route around a partitioned backend link instantly', () => {
		const engine = new SimEngine(
			{
				nodes: [node('lb', { componentId: 'load-balancer', maxQPS: 1e6 }), node('a'), node('b')],
				edges: [edge('lb', 'a'), edge('lb', 'b')],
				topics: []
			},
			config(1000)
		);
		run(engine, 10);
		engine.inject_({ type: 'partition-edge', edgeId: 'lb->a' });
		run(engine, 10);
		expect(engine.nodeState('a')!.inRate).toBe(0);
		expect(engine.nodeState('b')!.inRate).toBeCloseTo(1000, 1);
	});
});

describe('circuit breakers', () => {
	function breakerSpec(): SimGraphSpec {
		return {
			nodes: [
				node('svc', { maxQPS: 10_000 }),
				node('db', { componentId: 'sql-db', maxQPS: 10_000 })
			],
			edges: [
				edge('svc', 'db', {
					breaker: { errorThreshold: 0.5, cooldownSec: 5 },
					retry: { max: 3, backoffMs: 300 }
				})
			],
			topics: []
		};
	}

	it('opens under sustained target failure, fails fast, then recovers via half-open probes', () => {
		const engine = new SimEngine(breakerSpec(), config(1000));
		run(engine, 20);

		engine.inject_({ type: 'error-inject', nodeId: 'db', fraction: 0.9 });
		run(engine, 50);
		const open = engine.nodeState('svc')!;
		expect(open.errorRate).toBeCloseTo(1000, 0);
		expect(engine.nodeState('db')!.inRate).toBeLessThan(100);

		engine.inject_({ type: 'error-inject', nodeId: 'db', fraction: 0 });
		run(engine, 400);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(1000, 0);
		expect(engine.nodeState('svc')!.errorRate).toBeCloseTo(0, 0);

		const kinds = engine.drainEvents().map((e) => e.kind);
		expect(kinds).toContain('breaker-open');
		expect(kinds).toContain('breaker-half-open');
		expect(kinds).toContain('breaker-closed');
	});

	it('an open breaker gates the retry line too (no probing storms)', () => {
		const engine = new SimEngine(breakerSpec(), config(1000));
		run(engine, 20);
		engine.inject_({ type: 'error-inject', nodeId: 'db', fraction: 0.9 });
		run(engine, 100);

		expect(engine.nodeState('db')!.retryInRate).toBeLessThan(60);
	});
});

describe('rolling restart', () => {
	it('sequentially dents capacity, one replica at a time', () => {
		const engine = new SimEngine(
			{ nodes: [node('svc', { maxQPS: 100, replicas: 4 })], edges: [], topics: [] },
			config(300)
		);
		run(engine, 10);
		expect(engine.nodeState('svc')!.droppedRate).toBe(0);

		engine.inject_({ type: 'rolling-restart', nodeId: 'svc', perReplicaSec: 5 });
		run(engine, 30);
		const mid = engine.nodeState('svc')!;
		expect(mid.utilization).toBeGreaterThan(0.9);

		run(engine, 200);
		expect(engine.nodeState('svc')!.utilization).toBeCloseTo(0.75, 2);
		expect(engine.drainEvents().some((e) => e.kind === 'deploy')).toBe(true);
	});
});

describe('connection pools', () => {
	it('a slow callee exhausts the pool and excess calls fail at the caller', () => {
		const engine = new SimEngine(
			{
				nodes: [
					node('api', { maxQPS: 10_000 }),
					node('db', { componentId: 'sql-db', maxQPS: 10_000, baseLatencyMs: 10 })
				],
				edges: [edge('api', 'db', { poolSize: 50 })],
				topics: []
			},
			config(1000)
		);
		run(engine, 20);

		expect(engine.nodeState('api')!.errorRate).toBe(0);

		engine.inject_({ type: 'latency-mult', nodeId: 'db', factor: 20 });
		run(engine, 20);
		const api = engine.nodeState('api')!;

		expect(engine.nodeState('db')!.inRate).toBeCloseTo(250, 0);
		expect(api.errorRate).toBeCloseTo(750, 0);
		expect(engine.drainEvents().some((e) => e.kind === 'pool-exhausted')).toBe(true);
	});
});

describe('per-entry traffic (journeys-lite)', () => {
	it('entries with their own RPS keep it; the global profile splits over the rest', () => {
		const engine = new SimEngine(
			{
				nodes: [
					node('web', { entryRps: 800 }),
					node('batch', { entryRps: 50 }),
					node('mobile'),
					node('db', { componentId: 'sql-db' })
				],
				edges: [edge('web', 'db'), edge('batch', 'db'), edge('mobile', 'db')],
				topics: []
			},
			config(1000)
		);
		run(engine, 10);
		expect(engine.nodeState('web')!.inRate).toBeCloseTo(800, 3);
		expect(engine.nodeState('batch')!.inRate).toBeCloseTo(50, 3);
		expect(engine.nodeState('mobile')!.inRate).toBeCloseTo(1000, 3);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(1850, 2);

		engine.inject_({ type: 'traffic-mult', factor: 2 });
		run(engine, 10);
		expect(engine.nodeState('web')!.inRate).toBeCloseTo(1600, 2);
		expect(engine.nodeState('mobile')!.inRate).toBeCloseTo(2000, 2);
	});
});

describe('cross-group latency', () => {
	it('sync hops across groups add the regional round-trip to path latency', () => {
		const build = (extra: number) =>
			new SimEngine(
				{
					nodes: [node('a', { baseLatencyMs: 20 }), node('b', { baseLatencyMs: 30 })],
					edges: [{ ...edge('a', 'b'), extraLatencyMs: extra }],
					topics: []
				},
				config(100)
			);
		const local = build(0);
		const crossRegion = build(50);
		run(local, 10);
		run(crossRegion, 10);
		const localFrame = new Float32Array(local.stride);
		const crossFrame = new Float32Array(crossRegion.stride);
		local.writeFrame(localFrame, 0);
		crossRegion.writeFrame(crossFrame, 0);
		const pathIdx = local.stride - 2;
		expect(localFrame[pathIdx]).toBeCloseTo(50, 1);
		expect(crossFrame[pathIdx]).toBeCloseTo(100, 1);
	});
});

describe('path latency', () => {
	it('async-only batch entries do not pollute user-facing path latency', () => {
		const engine = new SimEngine(
			{
				nodes: [
					node('web', { baseLatencyMs: 20 }),
					node('etl', { componentId: 'data-warehouse', baseLatencyMs: 5000, entryRps: 10 }),
					node('db', { componentId: 'sql-db', baseLatencyMs: 10 })
				],
				edges: [edge('web', 'db'), edge('etl', 'db', { kind: 'async' })],
				topics: []
			},
			config(100)
		);
		run(engine, 10);
		const frame = new Float32Array(engine.stride);
		engine.writeFrame(frame, 0);
		expect(frame[engine.stride - 2]).toBeCloseTo(30, 1);
	});
});
