import { describe, expect, it } from 'vitest';
import { DT, SimEngine } from './engine';
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
	return {
		id: `${source}->${target}`,
		source,
		target,
		kind: 'sync',
		weight: 1,
		...overrides
	};
}

function config(rps: number, overrides: Partial<SimConfig> = {}): SimConfig {
	return { seed: 42, profile: { kind: 'constant', rps }, durationSec: 3600, ...overrides };
}

function spec(nodes: SimNodeSpec[], edges: SimEdgeSpec[]): SimGraphSpec {
	return { nodes, edges, topics: [] };
}

function run(engine: SimEngine, ticks: number): void {
	for (let i = 0; i < ticks; i++) engine.tick();
}

describe('edge weights + cache semantics', () => {
	it('fanout edges carry their configured fraction', () => {
		const engine = new SimEngine(
			spec(
				[node('app'), node('primary'), node('audit')],
				[edge('app', 'primary', { weight: 1 }), edge('app', 'audit', { weight: 0.1 })]
			),
			config(1000)
		);
		run(engine, 30);
		expect(engine.nodeState('primary')!.inRate).toBeCloseTo(1000, 2);
		expect(engine.nodeState('audit')!.inRate).toBeCloseTo(100, 2);
	});

	it('split (LB) weights are relative shares', () => {
		const engine = new SimEngine(
			spec(
				[node('lb', { componentId: 'load-balancer', maxQPS: 1e6 }), node('big'), node('small')],
				[edge('lb', 'big', { weight: 0.75 }), edge('lb', 'small', { weight: 0.25 })]
			),
			config(1000)
		);
		run(engine, 30);
		expect(engine.nodeState('big')!.inRate).toBeCloseTo(750, 2);
		expect(engine.nodeState('small')!.inRate).toBeCloseTo(250, 2);
	});

	it('a warm cache forwards only its misses; a revived cache stampedes then re-warms', () => {
		const engine = new SimEngine(
			spec(
				[
					node('app'),
					node('redis', {
						componentId: 'cache',
						maxQPS: 1e5,
						cache: { hitRatio: 0.9, warmupSec: 10 }
					}),
					node('db', { componentId: 'sql-db', maxQPS: 2000 })
				],
				[edge('app', 'redis'), edge('redis', 'db')]
			),
			config(1000)
		);
		run(engine, 30);

		expect(engine.nodeState('db')!.inRate).toBeCloseTo(100, 1);

		engine.inject_({ type: 'kill-node', nodeId: 'redis' });
		run(engine, 10);
		engine.inject_({ type: 'revive-node', nodeId: 'redis' });
		run(engine, 5);
		expect(engine.nodeState('db')!.inRate).toBeGreaterThan(800);
		expect(engine.nodeState('redis')!.hitRatio).toBeLessThan(0.2);

		run(engine, 150);
		expect(engine.nodeState('redis')!.hitRatio).toBeCloseTo(0.9, 5);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(100, 0);
	});
});

describe('timeouts', () => {
	it('sheds queue waits beyond the deadline as timeout errors', () => {
		const engine = new SimEngine(
			spec([node('worker', { maxQPS: 100, queueBound: 10_000, timeoutMs: 2000 })], []),
			config(500)
		);
		run(engine, 100);
		const w = engine.nodeState('worker')!;
		expect(w.health).toBe(1);
		expect(w.served).toBeCloseTo(75, 1);

		expect(w.queueDepth).toBeCloseTo(150, 0);
		expect(w.timeoutRate).toBeCloseTo(425, 0);
		expect(w.droppedRate).toBe(0);

		expect((w.queueDepth / 75) * 1000).toBeLessThanOrEqual(2000 + 1);
		expect(w.latencyMs).toBeLessThanOrEqual(2000 + 1000);
	});

	it('conserves flow with timeouts active: in = served + errors + timeouts + dropped + Δqueue', () => {
		const engine = new SimEngine(
			spec(
				[
					node('a', { maxQPS: 300, queueBound: 500, timeoutMs: 1000 }),
					node('b', { maxQPS: 100, queueBound: 2000, timeoutMs: 3000 })
				],
				[edge('a', 'b')]
			),
			config(800)
		);
		for (let t = 0; t < 200; t++) {
			const beforeA = engine.nodeState('a')!.queueDepth;
			const beforeB = engine.nodeState('b')!.queueDepth;
			engine.tick();
			for (const [id, before] of [
				['a', beforeA],
				['b', beforeB]
			] as const) {
				const s = engine.nodeState(id)!;
				const balance =
					s.inRate * DT -
					(s.served + s.errorRate + s.timeoutRate + s.droppedRate) * DT -
					(s.queueDepth - before);
				expect(Math.abs(balance)).toBeLessThan(1e-6);
			}
		}
	});
});

describe('retries', () => {
	it('failed calls re-offer load after backoff (retry storm amplification)', () => {
		const engine = new SimEngine(
			spec(
				[node('api', { maxQPS: 10_000 }), node('db', { componentId: 'sql-db', maxQPS: 100 })],
				[edge('api', 'db', { retry: { max: 3, backoffMs: 300 } })]
			),
			config(500)
		);
		run(engine, 100);
		const db = engine.nodeState('db')!;

		expect(db.retryInRate).toBeGreaterThan(300);
		expect(db.inRate).toBeGreaterThan(900);
		expect(db.served).toBeCloseTo(75, 0);
	});

	it('no failures -> no retry traffic', () => {
		const engine = new SimEngine(
			spec(
				[node('api'), node('db', { componentId: 'sql-db', maxQPS: 10_000 })],
				[edge('api', 'db', { retry: { max: 3, backoffMs: 300 } })]
			),
			config(500)
		);
		run(engine, 100);
		expect(engine.nodeState('db')!.retryInRate).toBe(0);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(500, 2);
	});
});

describe('autoscaling', () => {
	it('races a traffic spike: errors during scale-out delay, recovery after warmup', () => {
		const engine = new SimEngine(
			spec(
				[
					node('svc', {
						maxQPS: 100,
						replicas: 2,
						queueBound: 100,
						timeoutMs: 1000,
						autoscale: {
							min: 2,
							max: 20,
							targetUtil: 0.7,
							scaleOutDelaySec: 5,
							scaleInDelaySec: 60,
							warmupSec: 5
						}
					})
				],
				[]
			),
			config(0, {
				profile: { kind: 'spike', baseRps: 100, spikeRps: 1000, atSec: 2, durationSec: 3600 }
			})
		);
		run(engine, 15);
		expect(engine.nodeState('svc')!.replicas).toBe(2);

		run(engine, 35);
		const during = engine.nodeState('svc')!;
		expect(during.replicas).toBeLessThan(3);
		expect(during.timeoutRate + during.droppedRate).toBeGreaterThan(300);

		run(engine, 250);
		const after = engine.nodeState('svc')!;
		expect(after.replicas).toBeCloseTo(Math.ceil(1000 / 70), 5);
		expect(after.timeoutRate + after.droppedRate).toBeLessThan(1);
		expect(after.utilization).toBeLessThan(0.8);

		const kinds = engine.drainEvents().map((e) => e.kind);
		expect(kinds).toContain('scaled-out');
	});

	it('scales back in after the load drops', () => {
		const engine = new SimEngine(
			spec(
				[
					node('svc', {
						maxQPS: 100,
						replicas: 2,
						autoscale: {
							min: 2,
							max: 20,
							targetUtil: 0.7,
							scaleOutDelaySec: 0,
							scaleInDelaySec: 5,
							warmupSec: 0
						}
					})
				],
				[]
			),
			config(0, {
				profile: { kind: 'spike', baseRps: 100, spikeRps: 1000, atSec: 5, durationSec: 20 }
			})
		);
		run(engine, 300);
		run(engine, 700);
		expect(engine.nodeState('svc')!.replicas).toBe(2);
	});
});

describe('seeded jitter', () => {
	it('same seed -> byte-identical runs; different seed -> different runs', () => {
		const build = (seed: number) =>
			new SimEngine(
				spec(
					[node('app', { queueBound: 500 }), node('db', { componentId: 'sql-db', maxQPS: 8000 })],
					[edge('app', 'db')]
				),
				config(2000, { seed, jitter: 0.05 })
			);
		const a = build(7);
		const b = build(7);
		const c = build(8);
		const framesA = new Float32Array(a.stride * 200);
		const framesB = new Float32Array(b.stride * 200);
		const framesC = new Float32Array(c.stride * 200);
		for (let t = 0; t < 200; t++) {
			a.tick();
			b.tick();
			c.tick();
			a.writeFrame(framesA, t * a.stride);
			b.writeFrame(framesB, t * b.stride);
			c.writeFrame(framesC, t * c.stride);
		}
		expect(framesA).toEqual(framesB);
		expect(framesA).not.toEqual(framesC);
	});

	it('jitter=0 keeps the sim perfectly smooth (v1 parity)', () => {
		const engine = new SimEngine(spec([node('app')], []), config(1000));
		run(engine, 50);
		expect(engine.nodeState('app')!.latencyMs).toBe(20);
	});

	it('jitter perturbs latency but conservation still holds exactly', () => {
		const engine = new SimEngine(
			spec([node('app', { maxQPS: 900, queueBound: 300, timeoutMs: 1000 })], []),
			config(1000, { jitter: 0.06 })
		);
		let sawVariation = false;
		let last = -1;
		for (let t = 0; t < 100; t++) {
			const before = engine.nodeState('app')!.queueDepth;
			engine.tick();
			const s = engine.nodeState('app')!;
			if (last >= 0 && Math.abs(s.latencyMs - last) > 0.01) sawVariation = true;
			last = s.latencyMs;
			const balance =
				s.inRate * DT -
				(s.served + s.errorRate + s.timeoutRate + s.droppedRate) * DT -
				(s.queueDepth - before);
			expect(Math.abs(balance)).toBeLessThan(1e-6);
		}
		expect(sawVariation).toBe(true);
	});
});
