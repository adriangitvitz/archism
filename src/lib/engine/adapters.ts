import type { DesignDoc, GraphEdge, GraphNode } from '../types/graph';
import { getComponentById } from '../catalog/components';
import { pubSubSemantics } from '../catalog/pubsub-semantics';
import type {
	AutoscaleSpec,
	SimEdgeSpec,
	SimGraphSpec,
	SimNodeSpec,
	SubscriberGroupSpec,
	TopicSpec
} from './types';

export function docToGraph(doc: DesignDoc): { nodes: GraphNode[]; edges: GraphEdge[] } {
	const nodes: GraphNode[] = [];
	for (const n of doc.nodes) {
		const spec = getComponentById(n.componentId);
		if (!spec) continue;
		nodes.push({
			id: n.id,
			componentId: n.componentId,
			label: n.label,
			category: spec.category,
			maxQPS: n.config.maxQPSOverride ?? spec.maxQPS,
			latencyMs: n.config.latencyMsOverride ?? spec.latencyMs,
			scalable: spec.scalable,
			stateful: spec.stateful,
			replicas: n.config.replicas ?? 1
		});
	}
	const edges: GraphEdge[] = doc.edges.map((e) => ({
		id: e.id,
		source: e.source,
		target: e.target,
		async: e.kind !== 'sync'
	}));
	return { nodes, edges };
}

function defaultQueueBound(componentId: string, category: string, maxQPS: number): number {
	if (componentId === 'message-queue') return 1_000_000;
	if (componentId === 'pub-sub') return 0;
	if (category === 'compute') return Math.ceil(maxQPS * 0.5);
	return 0;
}

function defaultTimeoutMs(category: string): number {
	return category === 'messaging' ? 0 : 10_000;
}

export const NATIVELY_AUTOSCALED = new Set(['serverless-container', 'faas']);

function autoscaleDefaults(componentId: string, replicas: number): AutoscaleSpec {
	const serverless =
		componentId === 'serverless-container' ||
		componentId === 'faas' ||
		componentId === 'task-scheduler' ||
		componentId === 'notification-service';
	return {
		min: replicas,
		max: Math.max(replicas * 10, replicas + 4),
		targetUtil: 0.7,
		scaleOutDelaySec: serverless ? 5 : 60,
		scaleInDelaySec: 300,
		warmupSec: serverless ? 2 : 30
	};
}

export function docToSimSpec(doc: DesignDoc): SimGraphSpec {
	const semantics = pubSubSemantics(doc.provider);
	const nodes: SimNodeSpec[] = [];
	const known = new Set<string>();
	for (const n of doc.nodes) {
		const spec = getComponentById(n.componentId);
		if (!spec) continue;
		known.add(n.id);
		const isTopic = n.componentId === 'pub-sub' || n.config.pubsub?.role === 'topic';
		const maxQPS = n.config.maxQPSOverride ?? spec.maxQPS;
		const replicas = n.config.replicas ?? 1;
		let autoscale: AutoscaleSpec | undefined;

		if (
			n.config.autoscale === true ||
			(NATIVELY_AUTOSCALED.has(n.componentId) && n.config.autoscale === undefined)
		)
			autoscale = autoscaleDefaults(n.componentId, replicas);
		else if (typeof n.config.autoscale === 'object') autoscale = n.config.autoscale;
		nodes.push({
			id: n.id,
			componentId: n.componentId,
			label: n.label,
			maxQPS,
			replicas,
			baseLatencyMs: n.config.latencyMsOverride ?? spec.latencyMs,
			routing: isTopic ? 'topic' : 'fanout',
			queueBound: defaultQueueBound(n.componentId, spec.category, maxQPS),
			entryRps: n.config.entryRps,
			timeoutMs: n.config.timeoutMs ?? defaultTimeoutMs(spec.category),
			autoscale,
			cache: n.config.cache
				? {
						hitRatio: Math.min(1, Math.max(0, n.config.cache.hitRatio)),
						warmupSec: n.config.cache.warmupSec ?? 30
					}
				: undefined
		});
	}

	const groupOf = new Map(doc.nodes.map((n) => [n.id, n.groupId]));
	const edges: SimEdgeSpec[] = doc.edges
		.filter((e) => known.has(e.source) && known.has(e.target))
		.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			kind: e.kind,
			weight: e.weight ?? 1,
			retry: e.retry,
			breaker: e.breaker,
			poolSize: e.poolSize,

			extraLatencyMs:
				groupOf.get(e.source) !== groupOf.get(e.target) &&
				(groupOf.get(e.source) || groupOf.get(e.target))
					? 50
					: 0
		}));

	const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));
	const topics: TopicSpec[] = [];
	for (const n of doc.nodes) {
		if (!known.has(n.id)) continue;
		const isTopic = n.componentId === 'pub-sub' || n.config.pubsub?.role === 'topic';
		if (!isTopic) continue;
		const subscriberIds = edges
			.filter((e) => e.kind === 'pubsub' && e.source === n.id)
			.map((e) => e.target);
		const groups = new Map<string, SubscriberGroupSpec>();
		for (const subId of subscriberIds) {
			const sub = nodeById.get(subId);
			const groupId = sub?.config.pubsub?.group || subId;
			const existing = groups.get(groupId);
			if (existing) {
				existing.memberNodeIds.push(subId);
			} else {
				groups.set(groupId, {
					id: groupId,
					memberNodeIds: [subId],
					failureFraction: sub?.config.pubsub?.failureFraction ?? 0,
					dlqNodeId: sub?.config.pubsub?.dlqNodeId
				});
			}
		}
		topics.push({
			nodeId: n.id,
			partitions: n.config.pubsub?.partitions ?? 8,
			partitionsCapParallelism: semantics.partitionsCapParallelism,
			retentionMessages: n.config.pubsub?.retentionMessages ?? 1_000_000,

			backpressure: semantics.canBackpressurePublishers
				? (n.config.pubsub?.backpressure ?? false)
				: false,
			groups: [...groups.values()]
		});
	}

	return { nodes, edges, topics };
}
