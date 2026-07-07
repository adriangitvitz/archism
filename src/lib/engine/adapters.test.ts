import { describe, expect, it } from 'vitest';
import type { DesignDoc, DesignNode } from '$lib/types/graph';
import { getComponentById } from '$lib/catalog/components';
import { docToGraph, docToSimSpec } from './adapters';

function doc(nodes: DesignNode[], provider: DesignDoc['provider'] = 'generic'): DesignDoc {
	const now = new Date().toISOString();
	return {
		schemaVersion: 1,
		id: 'd1',
		name: 'test',
		provider,
		nodes,
		edges: [],
		groups: [],
		meta: { createdAt: now, updatedAt: now }
	};
}

function node(id: string, componentId: string, config: DesignNode['config'] = {}): DesignNode {
	return { id, componentId, label: id, position: { x: 0, y: 0 }, config };
}

describe('latencyMsOverride', () => {
	it('flows into the sim spec and the scoring graph, defaulting to the catalog value', () => {
		const d = doc([node('sap', 'custom', { latencyMsOverride: 500 }), node('app', 'app-server')]);
		const spec = docToSimSpec(d);
		const sap = spec.nodes.find((n) => n.id === 'sap')!;
		const app = spec.nodes.find((n) => n.id === 'app')!;
		expect(sap.baseLatencyMs).toBe(500);
		expect(app.baseLatencyMs).toBe(getComponentById('app-server')!.latencyMs);

		const graph = docToGraph(d);
		expect(graph.nodes.find((n) => n.id === 'sap')!.latencyMs).toBe(500);
		expect(graph.nodes.find((n) => n.id === 'app')!.latencyMs).toBe(
			getComponentById('app-server')!.latencyMs
		);
	});
});

describe('per-provider pub/sub semantics', () => {
	const topic = () =>
		node('t', 'pub-sub', {
			pubsub: { role: 'topic', partitions: 4, backpressure: true }
		});

	it('GCP: partitions do not cap parallelism and publisher backpressure is forced off', () => {
		const spec = docToSimSpec(doc([topic()], 'gcp'));
		const t = spec.topics.find((x) => x.nodeId === 't')!;
		expect(t.partitionsCapParallelism).toBe(false);
		expect(t.backpressure).toBe(false);
	});

	it('AWS SNS: also uncapped and non-backpressuring', () => {
		const t = docToSimSpec(doc([topic()], 'aws')).topics[0];
		expect(t.partitionsCapParallelism).toBe(false);
		expect(t.backpressure).toBe(false);
	});

	it('Azure Event Hubs: partition-capped and honors backpressure', () => {
		const t = docToSimSpec(doc([topic()], 'azure')).topics[0];
		expect(t.partitionsCapParallelism).toBe(true);
		expect(t.backpressure).toBe(true);
	});

	it('bare-metal Kafka: partition-capped and honors backpressure', () => {
		const t = docToSimSpec(doc([topic()], 'baremetal')).topics[0];
		expect(t.partitionsCapParallelism).toBe(true);
		expect(t.backpressure).toBe(true);
	});
});
