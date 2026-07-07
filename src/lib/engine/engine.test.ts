import { describe, expect, it } from 'vitest';
import { DT, SimEngine } from './engine';
import type { SimConfig, SimEdgeSpec, SimGraphSpec, SimNodeSpec, TopicSpec } from './types';
import { mulberry32 } from './rng';

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

function edge(source: string, target: string, kind: SimEdgeSpec['kind'] = 'sync'): SimEdgeSpec {
	return { id: `${source}->${target}`, source, target, kind, weight: 1 };
}

function config(rps: number, overrides: Partial<SimConfig> = {}): SimConfig {
	return { seed: 42, profile: { kind: 'constant', rps }, durationSec: 60, ...overrides };
}

function spec(nodes: SimNodeSpec[], edges: SimEdgeSpec[], topics: TopicSpec[] = []): SimGraphSpec {
	return { nodes, edges, topics };
}

function run(engine: SimEngine, ticks: number): void {
	for (let i = 0; i < ticks; i++) engine.tick();
}

describe('SimEngine', () => {
	it('is deterministic: identical specs produce byte-identical frame streams', () => {
		const build = () => {
			const s = spec(
				[
					node('lb', { componentId: 'load-balancer', maxQPS: 1e6, baseLatencyMs: 1 }),
					node('app1', { queueBound: 500 }),
					node('app2', { queueBound: 500 }),
					node('db', { componentId: 'sql-db', maxQPS: 8000, baseLatencyMs: 8 })
				],
				[edge('lb', 'app1'), edge('lb', 'app2'), edge('app1', 'db'), edge('app2', 'db')]
			);
			const engine = new SimEngine(s, config(6000));
			engine.inject_({ type: 'kill-node', nodeId: 'app1', atSimTime: 10, recoverAfterSec: 5 });
			engine.inject_({ type: 'traffic-mult', factor: 3, durationSec: 10, atSimTime: 20 });
			return engine;
		};
		const a = build();
		const b = build();
		const framesA = new Float32Array(a.stride * 600);
		const framesB = new Float32Array(b.stride * 600);
		for (let t = 0; t < 600; t++) {
			a.tick();
			b.tick();
			a.writeFrame(framesA, t * a.stride);
			b.writeFrame(framesB, t * b.stride);
		}
		expect(framesA).toEqual(framesB);
	});

	it('matches the steady-state analyzer under constant sub-capacity load', () => {
		const engine = new SimEngine(
			spec(
				[
					node('lb', { componentId: 'load-balancer', maxQPS: 1e6, baseLatencyMs: 1 }),
					node('app', { maxQPS: 5000, baseLatencyMs: 20 }),
					node('db', { componentId: 'sql-db', maxQPS: 10000, baseLatencyMs: 8 })
				],
				[edge('lb', 'app'), edge('app', 'db')]
			),
			config(1000)
		);
		run(engine, 100);
		const app = engine.nodeState('app')!;
		expect(app.inRate).toBeCloseTo(1000, 3);
		expect(app.served).toBeCloseTo(1000, 3);
		expect(app.utilization).toBeCloseTo(0.2, 3);
		expect(app.latencyMs).toBeCloseTo(20, 1);
		expect(app.queueDepth).toBeCloseTo(0, 3);
		const db = engine.nodeState('db')!;
		expect(db.inRate).toBeCloseTo(1000, 3);
	});

	it('caps served at capacity, sheds excess, then degrades under sustained overload', () => {
		const engine = new SimEngine(
			spec(
				[node('app', { maxQPS: 500 }), node('db', { componentId: 'sql-db', maxQPS: 10000 })],
				[edge('app', 'db')]
			),
			config(5000)
		);
		run(engine, 20);
		let app = engine.nodeState('app')!;
		expect(app.utilization).toBe(2);
		expect(app.served).toBeCloseTo(500, 3);
		expect(app.droppedRate).toBeCloseTo(4500, 2);
		expect(app.health).toBe(0);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(500, 3);

		run(engine, 30);
		app = engine.nodeState('app')!;
		expect(app.health).toBe(1);
		expect(app.served).toBeCloseTo(375, 3);
		expect(engine.nodeState('db')!.inRate).toBeCloseTo(375, 3);
	});

	it('load balancer fails over to live children when one dies', () => {
		const engine = new SimEngine(
			spec(
				[
					node('lb', { componentId: 'load-balancer', maxQPS: 1e6 }),
					node('app1', { maxQPS: 5000 }),
					node('app2', { maxQPS: 5000 })
				],
				[edge('lb', 'app1'), edge('lb', 'app2')]
			),
			config(2000)
		);
		run(engine, 20);
		expect(engine.nodeState('app1')!.inRate).toBeCloseTo(1000, 3);
		expect(engine.nodeState('app2')!.inRate).toBeCloseTo(1000, 3);

		engine.inject_({ type: 'kill-node', nodeId: 'app1' });
		run(engine, 20);
		const app1 = engine.nodeState('app1')!;
		expect(app1.inRate).toBeCloseTo(1000, 3);
		expect(app1.errorRate).toBeCloseTo(1000, 3);
		expect(engine.nodeState('app2')!.inRate).toBeCloseTo(1000, 3);

		run(engine, 100);
		expect(engine.nodeState('app1')!.inRate).toBe(0);
		expect(engine.nodeState('app2')!.inRate).toBeCloseTo(2000, 3);
		expect(engine.drainEvents().some((e) => e.kind === 'lb-ejected' && e.nodeId === 'app1')).toBe(
			true
		);
	});

	it("grows topic lag when a subscriber group can't keep up, and routes DLQ traffic", () => {
		const engine = new SimEngine(
			spec(
				[
					node('producer', { maxQPS: 10000 }),
					node('topic', {
						componentId: 'pub-sub',
						routing: 'topic',
						maxQPS: 1e6,
						baseLatencyMs: 5
					}),
					node('slow-sub', { maxQPS: 100 }),
					node('fast-sub', { maxQPS: 10000 }),
					node('dlq', { componentId: 'pub-sub', routing: 'topic', maxQPS: 1e6 })
				],
				[
					edge('producer', 'topic', 'async'),
					edge('topic', 'slow-sub', 'pubsub'),
					edge('topic', 'fast-sub', 'pubsub')
				],
				[
					{
						nodeId: 'topic',
						partitions: 4,
						partitionsCapParallelism: true,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [
							{ id: 'slow', memberNodeIds: ['slow-sub'], failureFraction: 0 },
							{ id: 'fast', memberNodeIds: ['fast-sub'], failureFraction: 0.2, dlqNodeId: 'dlq' }
						]
					}
				]
			),
			config(500)
		);
		run(engine, 100);

		const slow = engine.groupState('topic', 'slow')!;
		expect(slow.consumeRate).toBeCloseTo(100, 1);
		expect(slow.lag).toBeGreaterThan(3500);
		expect(slow.lag).toBeLessThan(4200);

		const fast = engine.groupState('topic', 'fast')!;
		expect(fast.consumeRate).toBeCloseTo(500, 1);
		expect(fast.lag).toBeLessThan(100);
		expect(fast.dlqRate).toBeCloseTo(100, 1);
		expect(engine.nodeState('dlq')!.inRate).toBeCloseTo(100, 1);

		expect(engine.nodeState('fast-sub')!.inRate).toBeCloseTo(500, 1);
	});

	it('a DLQ with its own consumer is not mistaken for a traffic entry point', () => {
		const engine = new SimEngine(
			spec(
				[
					node('producer', { maxQPS: 10000 }),
					node('topic', {
						componentId: 'pub-sub',
						routing: 'topic',
						maxQPS: 1e6,
						baseLatencyMs: 5
					}),
					node('sub', { maxQPS: 10000 }),

					node('dlq', { componentId: 'pub-sub', routing: 'topic', maxQPS: 1e6 }),
					node('reprocessor', { maxQPS: 10000 })
				],
				[
					edge('producer', 'topic', 'async'),
					edge('topic', 'sub', 'pubsub'),
					edge('dlq', 'reprocessor', 'pubsub')
				],
				[
					{
						nodeId: 'topic',
						partitions: 4,
						partitionsCapParallelism: true,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [{ id: 'g', memberNodeIds: ['sub'], failureFraction: 0.2, dlqNodeId: 'dlq' }]
					},
					{
						nodeId: 'dlq',
						partitions: 1,
						partitionsCapParallelism: true,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [{ id: 'reprocess', memberNodeIds: ['reprocessor'], failureFraction: 0 }]
					}
				]
			),
			config(500)
		);
		run(engine, 100);

		expect(engine.nodeState('dlq')!.inRate).toBeCloseTo(100, 1);
		expect(engine.nodeState('producer')!.inRate).toBeCloseTo(500, 1);

		const reprocess = engine.groupState('dlq', 'reprocess')!;
		expect(reprocess.consumeRate).toBeCloseTo(100, 1);
		expect(reprocess.lag).toBeLessThan(100);
	});

	it('partitions cap subscriber-group parallelism', () => {
		const engine = new SimEngine(
			spec(
				[
					node('producer', { maxQPS: 10000 }),
					node('topic', { componentId: 'pub-sub', routing: 'topic', maxQPS: 1e6 }),
					node('sub1', { maxQPS: 100 }),
					node('sub2', { maxQPS: 100 }),
					node('sub3', { maxQPS: 100 })
				],
				[edge('producer', 'topic', 'async')],
				[
					{
						nodeId: 'topic',
						partitions: 2,
						partitionsCapParallelism: true,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [{ id: 'g', memberNodeIds: ['sub1', 'sub2', 'sub3'], failureFraction: 0 }]
					}
				]
			),
			config(1000)
		);
		run(engine, 50);
		expect(engine.groupState('topic', 'g')!.consumeRate).toBeCloseTo(200, 1);
	});

	it('managed pub/sub (partitionsCapParallelism=false) is NOT capped by partition count', () => {
		const engine = new SimEngine(
			spec(
				[
					node('producer', { maxQPS: 10000 }),
					node('topic', { componentId: 'pub-sub', routing: 'topic', maxQPS: 1e6 }),
					node('sub1', { maxQPS: 100 }),
					node('sub2', { maxQPS: 100 }),
					node('sub3', { maxQPS: 100 })
				],
				[edge('producer', 'topic', 'async')],
				[
					{
						nodeId: 'topic',
						partitions: 2,
						partitionsCapParallelism: false,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [{ id: 'g', memberNodeIds: ['sub1', 'sub2', 'sub3'], failureFraction: 0 }]
					}
				]
			),
			config(1000)
		);
		run(engine, 50);

		expect(engine.groupState('topic', 'g')!.consumeRate).toBeCloseTo(300, 1);
	});

	it('backpressure throttles producers of a congested bounded queue', () => {
		const engine = new SimEngine(
			spec(
				[
					node('producer', { maxQPS: 10000, queueBound: 0 }),
					node('worker', { maxQPS: 100, queueBound: 1000 })
				],
				[edge('producer', 'worker', 'async')]
			),
			config(500)
		);
		run(engine, 400);

		const worker = engine.nodeState('worker')!;
		const producer = engine.nodeState('producer')!;
		expect(worker.queueDepth).toBeLessThanOrEqual(1000);

		expect(worker.health).toBe(0);
		expect(worker.served).toBeCloseTo(100, 1);

		expect(producer.errorRate).toBeGreaterThan(300);

		expect(worker.inRate).toBeLessThan(150);
	});

	it('publish-burst injects an impulse into the topic', () => {
		const engine = new SimEngine(
			spec(
				[
					node('topic', { componentId: 'pub-sub', routing: 'topic', maxQPS: 1e6 }),
					node('sub', { maxQPS: 50 })
				],
				[],
				[
					{
						nodeId: 'topic',
						partitions: 1,
						partitionsCapParallelism: true,
						retentionMessages: 1e9,
						backpressure: false,
						groups: [{ id: 'g', memberNodeIds: ['sub'], failureFraction: 0 }]
					}
				]
			),
			config(0)
		);
		run(engine, 10);
		expect(engine.groupState('topic', 'g')!.lag).toBe(0);
		engine.inject_({ type: 'publish-burst', topicId: 'topic', messages: 1000 });
		run(engine, 30);
		const group = engine.groupState('topic', 'g')!;
		expect(group.lag).toBeGreaterThan(500);
	});

	it('conserves flow per node: in = served + errored + dropped + Δqueue', () => {
		const rand = mulberry32(7);
		for (let trial = 0; trial < 10; trial++) {
			const layers = 2 + Math.floor(rand() * 3);
			const nodes: SimNodeSpec[] = [];
			const edges: SimEdgeSpec[] = [];
			const layerNodes: string[][] = [];
			for (let l = 0; l < layers; l++) {
				const count = 1 + Math.floor(rand() * 3);
				const ids: string[] = [];
				for (let i = 0; i < count; i++) {
					const id = `n${l}-${i}`;
					ids.push(id);
					nodes.push(
						node(id, {
							componentId: rand() < 0.3 ? 'load-balancer' : 'app-server',
							maxQPS: 100 + Math.floor(rand() * 5000),
							queueBound: rand() < 0.5 ? Math.floor(rand() * 500) : 0
						})
					);
				}
				layerNodes.push(ids);
				if (l > 0) {
					for (const target of ids) {
						for (const source of layerNodes[l - 1]) {
							if (rand() < 0.7) edges.push(edge(source, target, rand() < 0.3 ? 'async' : 'sync'));
						}
					}
				}
			}
			const engine = new SimEngine(spec(nodes, edges), config(Math.floor(rand() * 8000) + 100));
			if (rand() < 0.5) {
				engine.inject_({
					type: 'kill-node',
					nodeId: nodes[Math.floor(rand() * nodes.length)].id,
					atSimTime: 1
				});
			}

			for (let t = 0; t < 100; t++) {
				const before = new Map(nodes.map((n) => [n.id, engine.nodeState(n.id)!.queueDepth]));
				engine.tick();
				for (const n of nodes) {
					const s = engine.nodeState(n.id)!;
					const dQueue = s.queueDepth - before.get(n.id)!;
					const balance = s.inRate * DT - (s.served + s.errorRate + s.droppedRate) * DT - dQueue;
					expect(Math.abs(balance)).toBeLessThan(1e-6 + s.inRate * DT * 1e-9);
				}
			}
		}
	});

	it('ramps and spikes follow the traffic profile', () => {
		const engine = new SimEngine(
			spec(
				[node('app', { maxQPS: 1e6 }), node('db', { maxQPS: 1e6, componentId: 'sql-db' })],
				[edge('app', 'db')]
			),
			config(0, { profile: { kind: 'ramp', fromRps: 0, toRps: 1000, durationSec: 10 } })
		);
		run(engine, 50);
		expect(engine.nodeState('app')!.inRate).toBeCloseTo(490, 0);
		run(engine, 60);
		expect(engine.nodeState('app')!.inRate).toBeCloseTo(1000, 0);
	});
});
