import type { GraphNode, GraphEdge } from '../../types/graph';
import type { CategoryScore, ScoringGraph } from '../../types/scoring';

export function scoreCost(
	nodes: GraphNode[],
	edges: GraphEdge[],
	graph: ScoringGraph
): CategoryScore {
	const feedback: string[] = [];
	const passed: string[] = [];
	let score = 0;

	const componentIds = nodes.map((n) => n.componentId);
	const connectedNodes = nodes.filter((n) => graph.reachable.has(n.id));
	const connectedIds = new Set(connectedNodes.map((n) => n.componentId));
	const placedIds = new Set(componentIds);

	if (nodes.length >= 3 && nodes.length <= 25) {
		score += 3;
		passed.push(
			'Appropriate number of components (' +
				nodes.length +
				') - not over-engineered or under-provisioned'
		);
	} else if (nodes.length < 3) {
		score += 1;
		feedback.push(
			'System has only ' +
				nodes.length +
				' component(s) - this is under-provisioned for any real workload. A minimal production system needs at least DNS → Load Balancer → App Server → Database. Add the missing layers.'
		);
	} else if (nodes.length <= 35) {
		score += 1;
		feedback.push(
			'System has ' +
				nodes.length +
				' components - this is getting complex. Each component adds operational cost (hosting, monitoring, on-call burden). Verify each component serves a distinct, necessary purpose.'
		);
	} else {
		feedback.push(
			'System has ' +
				nodes.length +
				' components - this is likely over-engineered. Each component adds operational cost (hosting, monitoring, on-call burden). Over-engineering a simple problem is as costly as under-engineering a complex one. Consider consolidating.'
		);
	}

	const storageNodes = nodes.filter((n) => n.category === 'storage');
	if (storageNodes.length >= 1 && storageNodes.length <= 5) {
		score += 3;
		passed.push('Appropriate number of storage components - each serves a distinct purpose');
	} else if (storageNodes.length === 0) {
		feedback.push(
			'No storage components in your design - where is data persisted? Every system needs at least one database. Without persistent storage, you lose all data on restart.'
		);
	} else {
		feedback.push(
			'You have ' +
				storageNodes.length +
				' storage components - consider consolidating. Each storage system requires backups, monitoring, and operational expertise. Use the minimum number of distinct stores that satisfy your access patterns.'
		);
	}

	const hasCache = connectedIds.has('cache');
	const hasDB = connectedIds.has('sql-db') || connectedIds.has('nosql-db');
	if (hasCache && hasDB) {
		score += 3;
		passed.push(
			'Cache reduces expensive database queries - a $50/mo Redis instance can save $500/mo in DB scaling costs'
		);
	} else if (hasDB && !hasCache) {
		if (placedIds.has('cache')) {
			feedback.push(
				"You placed a Cache but it isn't connected to the request path - it's costing money without absorbing any database load. Connect your App Servers to it."
			);
		} else {
			feedback.push(
				'Add a Cache (Redis/Memcached) to reduce database load and cost. Databases are one of the most expensive components to scale. A cache costing $50-100/month can handle reads that would otherwise require a $500+/month larger DB instance.'
			);
		}
	}

	const nodeIds = new Set(nodes.map((n) => n.id));
	const attachedNodes = new Set<string>();
	for (const edge of edges) {
		if (edge.source === edge.target) continue;
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
		attachedNodes.add(edge.source);
		attachedNodes.add(edge.target);
	}
	const disconnected = nodes.filter((n) => !attachedNodes.has(n.id));
	if (disconnected.length === 0) {
		score += 3;
		passed.push('All components are connected - no wasted resources sitting idle');
	} else {
		feedback.push(
			`${disconnected.length} disconnected component(s) are not connected to anything - they're costing money without providing value. Either connect them to your architecture or remove them. Idle infrastructure is pure waste.`
		);
	}

	if (connectedIds.has('cdn')) {
		score += 3;
		passed.push(
			'CDN offloads traffic from origin servers, reducing compute and bandwidth costs significantly'
		);
	} else if (placedIds.has('cdn')) {
		feedback.push(
			"You placed a CDN but it isn't connected to the request path - it can't offload any origin traffic. Put it in front of your origin servers."
		);
	} else {
		feedback.push(
			'Add a CDN to offload static content delivery from your origin servers. CDN bandwidth costs $0.01-0.08/GB vs $0.09-0.12/GB for origin egress. For a media-heavy service serving 100TB/month, a CDN can save $4,000-8,000/month in bandwidth alone.'
		);
	}

	if (connectedIds.has('message-queue')) {
		score += 3;
		passed.push(
			'Message queue enables right-sizing compute - process background tasks at lower priority instead of provisioning for peak'
		);
	} else if (placedIds.has('message-queue')) {
		feedback.push(
			"You placed a Message Queue but it isn't connected to the request path - no work is being offloaded to it. Connect a producer so it can absorb background tasks."
		);
	} else {
		feedback.push(
			'Add a Message Queue for background processing. Without async offloading, you must provision your App Servers for peak load including background tasks. With a queue, you can run cheaper, smaller worker instances that process tasks at their own pace.'
		);
	}

	const hasApiGw = placedIds.has('api-gateway');
	const hasRateLimiter = placedIds.has('rate-limiter');
	const hasServiceMesh = placedIds.has('service-mesh');
	const duplicateNetworking = hasApiGw && hasRateLimiter && hasServiceMesh;
	if (!duplicateNetworking) {
		score += 2;
		passed.push('No excessive duplication of networking functionality');
	} else {
		feedback.push(
			'You have an API Gateway, Rate Limiter, and Service Mesh - some functionality overlaps. API Gateways often include rate limiting built-in. Consider whether you need all three or if consolidating would reduce complexity and cost.'
		);
	}

	return { category: 'Cost Efficiency', score, maxScore: 20, feedback, passed };
}
