import type { DesignDoc } from '../types/graph';
import type { ValidationIssue } from '../types/validation';
import { buildScoringGraph } from './graph';
import { docToGraph, NATIVELY_AUTOSCALED } from '../engine/adapters';
import { getComponentById } from '../catalog/components';
import { providerConstraints } from '../catalog/providers';

const DURABLE_STORES = new Set([
	'sql-db',
	'nosql-db',
	'object-storage',
	'timeseries-db',
	'graph-db',
	'file-store'
]);

export function validateDesign(doc: DesignDoc): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const { nodes, edges } = docToGraph(doc);
	if (nodes.length === 0) return issues;
	const graph = buildScoringGraph(nodes, edges);

	const dlqTargets = new Set(
		doc.nodes.map((n) => n.config.pubsub?.dlqNodeId).filter((id): id is string => !!id)
	);
	const attached = new Set<string>(dlqTargets);
	for (const e of edges) {
		if (e.source === e.target) continue;
		attached.add(e.source);
		attached.add(e.target);
	}
	for (const n of nodes) {
		if (nodes.length > 1 && !attached.has(n.id)) {
			issues.push({
				ruleId: 'connectivity/disconnected',
				severity: 'warning',
				message: `"${n.label ?? n.componentId}" isn't connected to anything - it plays no role in the system.`,
				nodeIds: [n.id]
			});
		} else if (attached.has(n.id) && !graph.reachable.has(n.id) && !dlqTargets.has(n.id)) {
			issues.push({
				ruleId: 'connectivity/unreachable',
				severity: 'warning',
				message: `"${n.label ?? n.componentId}" is wired but not reachable from any entry point - traffic never arrives.`,
				nodeIds: [n.id]
			});
		}
	}

	for (const n of nodes) {
		if (!graph.reachable.has(n.id)) continue;
		const replicas = n.replicas || 1;
		if (n.stateful && replicas === 1 && DURABLE_STORES.has(n.componentId)) {
			issues.push({
				ruleId: 'spof/unreplicated-store',
				severity: 'error',
				message: `"${n.label ?? n.componentId}" is a durable store with a single replica - losing it loses data and availability. Set replicas ≥ 2.`,
				nodeIds: [n.id]
			});
		} else if (!n.scalable && replicas === 1) {
			issues.push({
				ruleId: 'spof/single-instance',
				severity: 'warning',
				message: `"${n.label ?? n.componentId}" can't scale and runs a single instance - a single point of failure on the request path.`,
				nodeIds: [n.id]
			});
		}
	}

	for (const n of doc.nodes) {
		const spec = getComponentById(n.componentId);
		if (!spec || !graph.reachable.has(n.id)) continue;

		const nativelyOn = NATIVELY_AUTOSCALED.has(n.componentId) && n.config.autoscale === undefined;
		if (
			spec.category === 'compute' &&
			spec.scalable &&
			!n.config.autoscale &&
			!nativelyOn &&
			(n.config.replicas ?? 1) <= 2
		) {
			issues.push({
				ruleId: 'autoscaling/missing',
				severity: 'info',
				message: `"${n.label}" has no autoscaling and ≤2 replicas - a traffic spike will saturate it. Enable autoscaling or raise replicas.`,
				nodeIds: [n.id]
			});
		}
	}

	for (const n of doc.nodes) {
		const isTopic = n.componentId === 'pub-sub' || n.config.pubsub?.role === 'topic';
		if (isTopic) {
			const hasSubscribers = doc.edges.some((e) => e.source === n.id && e.kind === 'pubsub');
			const isDlqTarget = dlqTargets.has(n.id);
			if (!hasSubscribers && !isDlqTarget && graph.reachable.has(n.id)) {
				issues.push({
					ruleId: 'pubsub/topic-without-subscribers',
					severity: 'warning',
					message: `Topic "${n.label}" has no subscribers (no outgoing pub/sub connection) - published events go nowhere.`,
					nodeIds: [n.id]
				});
			} else if (isDlqTarget && !hasSubscribers) {
				issues.push({
					ruleId: 'pubsub/dlq-without-subscribers',
					severity: 'info',
					message: `Dead-letter topic "${n.label}" has no subscribers - dead-lettered messages land there but nothing can inspect or reprocess them. Wire a consumer (or accept it as a write-only graveyard).`,
					nodeIds: [n.id]
				});
			}
		}
		const ps = n.config.pubsub;
		if (ps?.role === 'subscriber' && (ps.failureFraction ?? 0) > 0 && !ps.dlqNodeId) {
			issues.push({
				ruleId: 'pubsub/subscriber-without-dlq',
				severity: 'warning',
				message: `Subscriber "${n.label}" fails ${((ps.failureFraction ?? 0) * 100).toFixed(0)}% of messages but has no dead-letter queue - failed messages are lost.`,
				nodeIds: [n.id]
			});
		}
	}

	const mapping = providerConstraints(doc.provider);
	const reachableComponentIds = new Set(
		nodes.filter((n) => graph.reachable.has(n.id)).map((n) => n.componentId)
	);
	for (const n of doc.nodes) {
		const skin = mapping[n.componentId];
		if (!skin?.constraints || !graph.reachable.has(n.id)) continue;
		const spec = getComponentById(n.componentId);
		for (const constraint of skin.constraints) {
			switch (constraint.check) {
				case 'maxQPS-cap': {
					const cap = Number(constraint.params?.cap ?? Infinity);
					const capacity =
						(n.config.maxQPSOverride ?? spec?.maxQPS ?? 0) * (n.config.replicas ?? 1);
					if (capacity > cap) {
						issues.push({
							ruleId: constraint.id,
							severity: constraint.severity,
							message: `"${n.label}": ${constraint.message}`,
							nodeIds: [n.id],
							provider: doc.provider
						});
					}
					break;
				}
				case 'requires-companion': {
					const companion = String(constraint.params?.companionId ?? '');
					if (companion && !reachableComponentIds.has(companion)) {
						issues.push({
							ruleId: constraint.id,
							severity: constraint.severity,
							message: `"${n.label}": ${constraint.message}`,
							nodeIds: [n.id],
							provider: doc.provider
						});
					}
					break;
				}
				case 'no-autoscale': {
					if (n.config.autoscale) {
						issues.push({
							ruleId: constraint.id,
							severity: constraint.severity,
							message: `"${n.label}": ${constraint.message}`,
							nodeIds: [n.id],
							provider: doc.provider
						});
					}
					break;
				}
			}
		}
	}

	const severityRank = { error: 0, warning: 1, info: 2 };
	return issues.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
