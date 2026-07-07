import type { DesignDoc, DesignEdge, DesignNode } from '$lib/types/graph';

export interface Preset {
	id: string;
	name: string;
	description: string;
	rps: number;
	howTo: string;
	nodes: DesignNode[];
	edges: DesignEdge[];
}

function n(
	id: string,
	componentId: string,
	label: string,
	x: number,
	y: number,
	config: DesignNode['config'] = {}
): DesignNode {
	return { id, componentId, label, position: { x, y }, config };
}

function e(source: string, target: string, extra: Partial<DesignEdge> = {}): DesignEdge {
	return { id: `${source}->${target}`, source, target, kind: 'sync', ...extra };
}

export const PRESETS: Preset[] = [
	{
		id: 'autoscale-race',
		name: 'Autoscale vs traffic spike',
		description:
			'A VM-speed autoscaler (15s provisioning + 10s warmup) races a 10× spike. Watch the timeout window before the cavalry arrives.',
		rps: 300,
		howTo:
			'Run at ~300 RPS, then hit "Spike ×10". Watch Timeline: timeouts spike, scaled-out fires, capacity ramps, errors recover.',
		nodes: [
			n('lb', 'load-balancer', 'Load Balancer', 0, 160),
			n('svc', 'app-server', 'API Service', 260, 160, {
				replicas: 2,
				maxQPSOverride: 200,
				timeoutMs: 1500,
				autoscale: {
					min: 2,
					max: 24,
					targetUtil: 0.7,
					scaleOutDelaySec: 15,
					scaleInDelaySec: 120,
					warmupSec: 10
				}
			}),
			n('db', 'nosql-db', 'DynamoDB', 520, 160, { replicas: 2 })
		],
		edges: [e('lb', 'svc'), e('svc', 'db')]
	},
	{
		id: 'retry-storm',
		name: 'Retry storm',
		description:
			'Aggressive client retries (3 attempts, 500ms backoff) turn a struggling database into a self-inflicted outage: failures re-offer load.',
		rps: 1000,
		howTo:
			'Run at ~1k RPS (healthy), then "Spike ×10". The DB saturates, fails calls, and retries nearly double its offered load (↻ badge). Compare recovery with retries removed.',
		nodes: [
			n('gw', 'api-gateway', 'API Gateway', 0, 160),
			n('app', 'app-server', 'Order Service', 260, 160, { replicas: 4 }),
			n('db', 'sql-db', 'Orders DB', 520, 160, {
				replicas: 1,
				maxQPSOverride: 2500,
				timeoutMs: 2000
			})
		],
		edges: [e('gw', 'app'), e('app', 'db', { retry: { max: 3, backoffMs: 500 } })]
	},
	{
		id: 'cache-stampede',
		name: 'Cache stampede',
		description:
			'A 90%-hit cache shields an undersized database. Kill and revive the cache: it comes back cold, the miss flood melts the DB, then warmup saves it.',
		rps: 2000,
		howTo:
			'Run at ~2k RPS (DB sees only ~200/s). Select Redis → "Kill node", wait a few seconds, "Revive node". Watch the DB drown in misses, then recover as the hit ratio re-warms over 20s.',
		nodes: [
			n('app', 'app-server', 'App Tier', 0, 160, { replicas: 3 }),
			n('redis', 'cache', 'Redis', 260, 160, { cache: { hitRatio: 0.9, warmupSec: 20 } }),
			n('db', 'sql-db', 'Postgres', 520, 160, { maxQPSOverride: 400, timeoutMs: 2000, replicas: 2 })
		],
		edges: [e('app', 'redis'), e('redis', 'db')]
	}
];

export function presetToDoc(preset: Preset, id: string, meta: DesignDoc['meta']): DesignDoc {
	return {
		schemaVersion: 1,
		id,
		name: preset.name,
		provider: 'aws',
		nodes: preset.nodes,
		edges: preset.edges,
		groups: [],
		meta
	};
}
