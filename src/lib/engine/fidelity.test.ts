import { describe, expect, it } from 'vitest';
import { SimEngine } from './engine';
import { docToSimSpec } from './adapters';
import { evaluateSlo, type SloReport, type SloSample, type SloTarget } from './slo';
import { validateDesign } from '$lib/validation/validator';
import type { DesignDoc, DesignEdge, DesignNode } from '$lib/types/graph';

const SLO: SloTarget = { targetLatencyMs: 500, targetAvailability: 0.99 };
const LOAD_RPS = 4000;
const TICKS = 400;

function node(id: string, componentId: string, config: DesignNode['config'] = {}): DesignNode {
	return { id, componentId, label: id, position: { x: 0, y: 0 }, config };
}
function edge(source: string, target: string, kind: DesignEdge['kind'] = 'sync'): DesignEdge {
	return { id: `${source}->${target}`, source, target, kind };
}
function design(name: string, nodes: DesignNode[], edges: DesignEdge[]): DesignDoc {
	const now = new Date().toISOString();
	return {
		schemaVersion: 1,
		id: name,
		name,
		provider: 'generic',
		nodes,
		edges,
		groups: [],
		slo: SLO,
		meta: { createdAt: now, updatedAt: now }
	};
}

function assess(doc: DesignDoc): { report: SloReport; errors: string[]; bottleneck: string } {
	const engine = new SimEngine(docToSimSpec(doc), {
		seed: 7,
		profile: { kind: 'constant', rps: LOAD_RPS },
		durationSec: 60
	});
	const history: SloSample[] = [];
	let bottleneck = '';
	for (let t = 0; t < TICKS; t++) {
		engine.tick();
		const tot = engine.totals();
		history.push({
			offered: tot.offered,
			delivered: tot.delivered,
			pathLatencyMs: tot.pathLatencyMs
		});
		if (t === TICKS - 1 && tot.bottleneckIdx >= 0) {
			bottleneck = doc.nodes[tot.bottleneckIdx]?.id ?? '';
		}
	}
	const report = evaluateSlo(history, SLO)!;
	const errors = validateDesign(doc)
		.filter((i) => i.severity === 'error')
		.map((i) => i.ruleId);
	return { report, errors, bottleneck };
}

const bad = design(
	'bad-read-api',
	[
		node('lb', 'load-balancer'),
		node('api', 'app-server', { replicas: 1, maxQPSOverride: 1500 }),
		node('db', 'sql-db', { replicas: 1, maxQPSOverride: 10000 })
	],
	[edge('lb', 'api'), edge('api', 'db')]
);

const good = design(
	'good-read-api',
	[
		node('lb', 'load-balancer', { replicas: 2 }),
		node('api', 'app-server', { replicas: 4, autoscale: true, maxQPSOverride: 1500 }),
		node('cache', 'cache', { replicas: 2, cache: { hitRatio: 0.8, warmupSec: 0 } }),
		node('db', 'sql-db', { replicas: 2, maxQPSOverride: 10000 })
	],
	[edge('lb', 'api'), edge('api', 'cache'), edge('cache', 'db')]
);

describe('fidelity: bad vs good design', () => {
	const b = assess(bad);
	const g = assess(good);

	it('FAILS the bad design, for the right reasons', () => {
		expect(b.report.pass).toBe(false);

		expect(b.report.availability).toBeLessThan(0.6);
		expect(b.bottleneck).toBe('api');

		expect(b.errors).toContain('spof/unreplicated-store');
	});

	it('PASSES the good design', () => {
		expect(g.report.pass).toBe(true);
		expect(g.report.availability).toBeGreaterThan(0.99);
		expect(g.errors).toEqual([]);
	});

	it('discriminates: the good design is dramatically more available', () => {
		expect(g.report.availability - b.report.availability).toBeGreaterThan(0.4);
	});
});

const retryStorm = design(
	'bad-retries',
	[
		node('lb', 'load-balancer'),
		node('api', 'app-server', { replicas: 8, maxQPSOverride: 2000 }),
		node('db', 'sql-db', { replicas: 2, maxQPSOverride: 1200 })
	],
	[edge('lb', 'api'), { ...edge('api', 'db'), retry: { max: 3, backoffMs: 50 } }]
);
const breakered = design(
	'good-breaker',
	[
		node('lb', 'load-balancer'),
		node('api', 'app-server', { replicas: 8, maxQPSOverride: 2000 }),
		node('db', 'sql-db', { replicas: 2, maxQPSOverride: 1200 })
	],
	[
		edge('lb', 'api'),
		{
			...edge('api', 'db'),
			retry: { max: 3, backoffMs: 50 },
			breaker: { errorThreshold: 0.5, cooldownSec: 5 }
		}
	]
);

describe('fidelity: retry storm vs circuit breaker', () => {
	it('the breaker design serves at least as much goodput as the bare-retry design', () => {
		const storm = assess(retryStorm);
		const guarded = assess(breakered);

		expect(guarded.report.availability).toBeGreaterThanOrEqual(storm.report.availability - 1e-6);
	});
});
