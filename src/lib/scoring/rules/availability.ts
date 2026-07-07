import type { GraphNode, GraphEdge } from '../../types/graph';
import type { CategoryScore, ScoringGraph } from '../../types/scoring';

const DURABLE_STORES = new Set([
	'sql-db',
	'nosql-db',
	'object-storage',
	'timeseries-db',
	'graph-db',
	'file-store'
]);

export function scoreAvailability(
	nodes: GraphNode[],
	_edges: GraphEdge[],
	graph: ScoringGraph
): CategoryScore {
	const feedback: string[] = [];
	const passed: string[] = [];
	let score = 0;

	const connectedNodes = nodes.filter((n) => graph.reachable.has(n.id));
	const connectedIds = new Set(connectedNodes.map((n) => n.componentId));
	const placedIds = new Set(nodes.map((n) => n.componentId));

	const scalableNodes = nodes.filter((n) => n.scalable || (n.replicas || 1) > 1);
	const noSpof = scalableNodes.length >= Math.ceil(nodes.length * 0.7);
	if (noSpof) {
		score += 3;
		passed.push(
			'At least 70% of components are scalable or redundant, minimizing single points of failure'
		);
	} else {
		feedback.push(
			"Too many single points of failure - over 30% of your components can't scale or failover. Most components on the critical path should be redundant. Use scalable components (App Server, Cache, NoSQL) and add replicas to stateful ones to target 99.9%+ availability."
		);
	}

	const isReplicatedDurableStore = (n: GraphNode) =>
		DURABLE_STORES.has(n.componentId) && (n.replicas || 1) > 1;
	const hasReplicatedStorage = connectedNodes.some(isReplicatedDurableStore);
	const placedReplicatedStorage = nodes.some(isReplicatedDurableStore);
	if (hasReplicatedStorage) {
		score += 3;
		passed.push(
			'Database replication provides real redundancy - failover to replica if primary goes down'
		);
	} else if (placedReplicatedStorage) {
		feedback.push(
			"You have a replicated database but it isn't connected to the request path. Connect it to your services so the replicas actually back the live system."
		);
	} else {
		feedback.push(
			"Add database replication (replicas > 1) to at least one durable storage component (SQL, NoSQL, object storage). Having multiple different storage types (e.g., Redis + PostgreSQL) isn't redundancy - if PostgreSQL goes down, Redis can't replace it. True redundancy means replicas of the same data store ready to take over on failure."
		);
	}

	const entryComponents = ['load-balancer', 'api-gateway', 'cdn'];
	const entryWithMultipleDownstream = connectedNodes.some(
		(n) => entryComponents.includes(n.componentId) && (graph.adjacency.get(n.id)?.length ?? 0) >= 2
	);
	const componentTypeCounts = new Map<string, number>();
	for (const n of connectedNodes) {
		const cid = n.componentId;
		componentTypeCounts.set(cid, (componentTypeCounts.get(cid) ?? 0) + 1);
	}
	const hasRedundantInstances = Array.from(componentTypeCounts.values()).some(
		(count) => count >= 2
	);
	const hasMultiPath = entryWithMultipleDownstream || hasRedundantInstances;
	if (hasMultiPath && nodes.length > 2) {
		score += 3;
		passed.push(
			'Redundant paths exist - entry points fan out to multiple targets or duplicate instances provide failover'
		);
	} else {
		feedback.push(
			'Add redundant data paths to avoid cascading failures. Entry-point components (load balancer, API gateway, CDN) should fan out to multiple downstream targets, or use multiple connected instances of the same component type for failover. A single chain (A→B→C→D) means any link failure takes down the entire system.'
		);
	}

	if (connectedIds.has('monitoring')) {
		score += 3;
		passed.push(
			'Monitoring enables fast incident detection and reduces Mean Time To Recovery (MTTR)'
		);
	} else if (placedIds.has('monitoring')) {
		feedback.push(
			"You placed Monitoring but it isn't connected to anything. Connect your services to it (metrics/log flow) so it can actually observe the system."
		);
	} else {
		feedback.push(
			"Add a Monitoring stack (Prometheus/Grafana, CloudWatch, Datadog) for alerting and observability. Without monitoring, outages go undetected until users complain - increasing MTTR from minutes to hours. You can't improve what you can't measure."
		);
	}

	const hasOverloadProtection = connectedIds.has('rate-limiter') || connectedIds.has('api-gateway');
	if (hasOverloadProtection) {
		score += 3;
		passed.push('Rate limiting / API gateway protects backend from traffic surges and abuse');
	} else if (placedIds.has('rate-limiter') || placedIds.has('api-gateway')) {
		feedback.push(
			"You placed a Rate Limiter / API Gateway but it isn't connected to the request path. Put it in front of your backend so it can actually shed excess traffic."
		);
	} else {
		feedback.push(
			'Add a Rate Limiter or API Gateway to protect your backend from traffic surges and DDoS attacks. Without overload protection, a sudden traffic spike (or malicious attack) can cascade through your entire system and cause a full outage.'
		);
	}

	const hasCache = connectedIds.has('cache');
	const hasDB = connectedIds.has('sql-db') || connectedIds.has('nosql-db');
	if (hasCache && hasDB) {
		score += 3;
		passed.push(
			'Cache enables graceful degradation - serves stale data if database becomes unavailable'
		);
	} else if (hasDB && !hasCache) {
		feedback.push(
			'Add a Cache layer (Redis/Memcached) in front of your database. Beyond performance, caching enables graceful degradation: if your DB goes down, the cache can continue serving recent data while you recover, keeping the system partially available.'
		);
	} else if (hasCache && !hasDB) {
		feedback.push(
			'You have a Cache but no connected database behind it. Graceful degradation needs both: the cache serves stale data while the database recovers. Add a durable store (SQL/NoSQL) on the request path to earn these points.'
		);
	} else {
		feedback.push(
			'Add a connected Cache + Database pair. A cache in front of a durable store enables graceful degradation - if the DB goes down, the cache keeps serving recent data while you recover.'
		);
	}

	if (connectedIds.has('message-queue')) {
		score += 2;
		passed.push('Message queue buffers requests during downstream outages, preventing data loss');
	} else if (placedIds.has('message-queue')) {
		feedback.push(
			"You placed a Message Queue but it isn't connected to the request path. Connect producers to it so it can actually buffer requests during outages."
		);
	} else {
		feedback.push(
			'Add a Message Queue (Kafka, SQS) to buffer requests during downstream outages. If a consumer service goes down, messages are retained in the queue and processed when it recovers - no data loss, no user-facing errors for async operations.'
		);
	}

	return { category: 'Availability', score, maxScore: 20, feedback, passed };
}
