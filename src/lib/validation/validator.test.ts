import { describe, expect, it } from 'vitest';
import type { DesignDoc, DesignEdge, DesignNode } from '$lib/types/graph';
import type { Provider } from '$lib/types/provider';
import { validateDesign } from './validator';

function doc(nodes: DesignNode[], edges: DesignEdge[], provider: Provider = 'generic'): DesignDoc {
	const now = new Date().toISOString();
	return {
		schemaVersion: 1,
		id: 'd1',
		name: 'test',
		provider,
		nodes,
		edges,
		groups: [],
		meta: { createdAt: now, updatedAt: now }
	};
}

function node(id: string, componentId: string, config: DesignNode['config'] = {}): DesignNode {
	return { id, componentId, label: id, position: { x: 0, y: 0 }, config };
}

function edge(source: string, target: string, kind: DesignEdge['kind'] = 'sync'): DesignEdge {
	return { id: `${source}->${target}`, source, target, kind };
}

const rules = (issues: { ruleId: string }[]) => issues.map((i) => i.ruleId);

describe('validateDesign', () => {
	it('flags disconnected and unreachable nodes', () => {
		const issues = validateDesign(
			doc(
				[
					node('a', 'app-server'),
					node('b', 'sql-db', { replicas: 2 }),
					node('lonely', 'cache'),
					node('x', 'cache'),
					node('y', 'monitoring')
				],
				[edge('a', 'b'), edge('x', 'y'), edge('y', 'x')]
			)
		);
		expect(rules(issues)).toContain('connectivity/disconnected');
		expect(rules(issues)).toContain('connectivity/unreachable');
	});

	it('flags unreplicated durable stores as errors and non-scalable singles as warnings', () => {
		const issues = validateDesign(
			doc(
				[node('app', 'app-server'), node('db', 'sql-db'), node('lock', 'distributed-lock')],
				[edge('app', 'db'), edge('app', 'lock')]
			)
		);
		const spof = issues.find((i) => i.ruleId === 'spof/unreplicated-store');
		expect(spof?.severity).toBe('error');
		expect(spof?.nodeIds).toEqual(['db']);

		expect(issues.find((i) => i.ruleId === 'spof/single-instance')?.nodeIds).toEqual(['lock']);

		const fixed = validateDesign(
			doc([node('app', 'app-server'), node('db', 'sql-db', { replicas: 2 })], [edge('app', 'db')])
		);
		expect(rules(fixed)).not.toContain('spof/unreplicated-store');
	});

	it('flags topics without subscribers and failing subscribers without DLQ', () => {
		const issues = validateDesign(
			doc(
				[
					node('app', 'app-server'),
					node('topic', 'pub-sub'),
					node('sub', 'stream-processor', { pubsub: { role: 'subscriber', failureFraction: 0.1 } })
				],
				[edge('app', 'topic', 'async'), edge('app', 'sub')]
			)
		);
		expect(rules(issues)).toContain('pubsub/topic-without-subscribers');
		expect(rules(issues)).toContain('pubsub/subscriber-without-dlq');
	});

	it('enforces bare-metal no-autoscale constraints', () => {
		const issues = validateDesign(
			doc(
				[node('app', 'app-server', { autoscale: true }), node('db', 'sql-db', { replicas: 2 })],
				[edge('app', 'db')],
				'baremetal'
			)
		);
		const constraint = issues.find((i) => i.ruleId.includes('baremetal') && i.nodeIds[0] === 'app');
		expect(constraint).toBeDefined();
		expect(constraint?.severity).toBe('error');

		const generic = validateDesign(
			doc(
				[node('app', 'app-server', { autoscale: true }), node('db', 'sql-db', { replicas: 2 })],
				[edge('app', 'db')]
			)
		);
		expect(generic.some((i) => i.provider)).toBe(false);
	});

	it('enforces AWS API Gateway RPS cap', () => {
		const issues = validateDesign(
			doc(
				[node('gw', 'api-gateway', { maxQPSOverride: 50000 }), node('app', 'app-server')],
				[edge('gw', 'app')],
				'aws'
			)
		);
		expect(issues.some((i) => i.ruleId.includes('api-gateway') && i.provider === 'aws')).toBe(true);
	});

	it('treats dlqNodeId-referenced topics as connected, hinting when they lack subscribers', () => {
		const issues = validateDesign(
			doc(
				[
					node('app', 'app-server', { replicas: 2 }),
					node('topic', 'pub-sub'),
					node('sub', 'stream-processor', {
						replicas: 2,
						pubsub: { role: 'subscriber', failureFraction: 0.1, dlqNodeId: 'dlq' }
					}),
					node('dlq', 'pub-sub')
				],
				[edge('app', 'topic', 'async'), edge('topic', 'sub', 'pubsub')]
			)
		);
		const forDlq = issues.filter((i) => i.nodeIds?.includes('dlq'));
		expect(rules(forDlq)).not.toContain('connectivity/disconnected');
		expect(rules(forDlq)).not.toContain('connectivity/unreachable');
		expect(rules(forDlq)).toContain('pubsub/dlq-without-subscribers');
	});

	it('stays quiet about a DLQ that has its own consumer', () => {
		const issues = validateDesign(
			doc(
				[
					node('app', 'app-server', { replicas: 2 }),
					node('topic', 'pub-sub'),
					node('sub', 'stream-processor', {
						replicas: 2,
						pubsub: { role: 'subscriber', failureFraction: 0.1, dlqNodeId: 'dlq' }
					}),
					node('dlq', 'pub-sub'),
					node('reprocessor', 'stream-processor', {
						replicas: 2,
						pubsub: { role: 'subscriber' }
					})
				],
				[
					edge('app', 'topic', 'async'),
					edge('topic', 'sub', 'pubsub'),
					edge('dlq', 'reprocessor', 'pubsub')
				]
			)
		);
		expect(rules(issues.filter((i) => i.nodeIds?.includes('dlq')))).toEqual([]);
	});

	it('skips the autoscaling hint for natively-autoscaled serverless compute', () => {
		const issues = validateDesign(
			doc(
				[
					node('run', 'serverless-container'),
					node('fn', 'faas'),
					node('vm', 'app-server'),
					node('off', 'serverless-container', { autoscale: false })
				],
				[edge('run', 'fn'), edge('fn', 'vm'), edge('vm', 'off')]
			)
		);
		const hinted = issues
			.filter((i) => i.ruleId === 'autoscaling/missing')
			.flatMap((i) => i.nodeIds ?? []);
		expect(hinted).not.toContain('run');
		expect(hinted).not.toContain('fn');
		expect(hinted).toContain('vm');
		expect(hinted).toContain('off');
	});

	it('stays quiet on a healthy design', () => {
		const issues = validateDesign(
			doc(
				[
					node('lb', 'load-balancer', { replicas: 2 }),
					node('app', 'app-server', { replicas: 3, autoscale: true }),
					node('db', 'sql-db', { replicas: 2 })
				],
				[edge('lb', 'app'), edge('app', 'db')]
			)
		);
		expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
	});
});
