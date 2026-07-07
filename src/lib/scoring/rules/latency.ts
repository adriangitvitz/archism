import type { GraphNode, GraphEdge } from '../../types/graph';
import type { CategoryScore, ScoringGraph } from '../../types/scoring';

export function scoreLatency(
	nodes: GraphNode[],
	edges: GraphEdge[],
	graph: ScoringGraph
): CategoryScore {
	const feedback: string[] = [];
	const passed: string[] = [];
	let score = 0;

	const connectedNodes = nodes.filter((n) => graph.reachable.has(n.id));
	const connectedIds = new Set(connectedNodes.map((n) => n.componentId));
	const placedIds = new Set(nodes.map((n) => n.componentId));

	if (connectedIds.has('cdn')) {
		score += 3;
		passed.push(
			'CDN serves content from edge locations, cutting latency from 200ms+ to <20ms for static assets'
		);
	} else if (placedIds.has('cdn')) {
		feedback.push(
			"You placed a CDN but it isn't connected to the request path. Put it in front of your origin (e.g., DNS → CDN → Load Balancer) so users actually hit the edge first."
		);
	} else {
		feedback.push(
			'Add a CDN (CloudFront, Cloudflare, Google Cloud CDN) to serve static content from edge locations close to users. Without a CDN, every request travels to your origin server - a user in Tokyo hitting a US-East server adds 150-200ms of network latency alone.'
		);
	}

	const adj = graph.adjacency;
	const cacheNodes = connectedNodes.filter((n) => n.componentId === 'cache');
	const dbNodes = connectedNodes.filter(
		(n) => n.componentId === 'sql-db' || n.componentId === 'nosql-db'
	);
	const cacheNodeIds = new Set(cacheNodes.map((c) => c.id));
	const dbNodeIds = new Set(dbNodes.map((d) => d.id));

	const cacheInFront = cacheNodes.some((c) => {
		const hop1 = adj.get(c.id) ?? [];
		if (hop1.some((id) => dbNodeIds.has(id))) return true;
		return hop1.some((mid) => (adj.get(mid) ?? []).some((id) => dbNodeIds.has(id)));
	});

	const cacheAside = connectedNodes.some((n) => {
		const children = adj.get(n.id) ?? [];
		return children.some((id) => cacheNodeIds.has(id)) && children.some((id) => dbNodeIds.has(id));
	});
	const cacheBeforeDB = cacheNodes.length > 0 && dbNodes.length > 0 && (cacheInFront || cacheAside);
	if (cacheBeforeDB) {
		score += 4;
		passed.push(
			'Cache intercepts reads before hitting the database - memory access (~1ms) vs disk (~5-10ms)'
		);
	} else if (cacheNodes.length > 0) {
		score += 1;
		feedback.push(
			"Your cache exists but isn't positioned to intercept reads before the database. Connect your App Server to both Cache and DB so it checks the cache first. A cache hit returns in ~1ms; a DB query takes 5-10ms or more - that's a 5-10x latency improvement on every cached read."
		);
	} else if (placedIds.has('cache')) {
		feedback.push(
			"You placed a Cache but it isn't connected to the request path. Connect your App Server to both Cache and DB (cache-aside) so reads check the cache first."
		);
	} else {
		feedback.push(
			'Add a Cache layer (Redis/Memcached) between your App Servers and Database. Reading from memory (~1ms) is 5-10x faster than reading from disk (~5-10ms). For read-heavy workloads, caching can serve 80-90% of requests without ever touching the database.'
		);
	}

	const { depth: maxDepth, cyclic } = computeMaxDepth(nodes, edges);
	if (cyclic) {
		feedback.push(
			"Your design contains a cycle - requests could loop forever, so the hop count can't be credited. Break the cycle (for example, make the back-edge asynchronous via a queue) to earn these points."
		);
	} else if (maxDepth <= 6) {
		score += 4;
		passed.push(
			'Request path has a lean hop count (' + maxDepth + ' layers) - minimal serialized latency'
		);
	} else if (maxDepth <= 8) {
		score += 2;
		passed.push('Request path has an acceptable hop count (' + maxDepth + ' layers)');
	} else {
		feedback.push(
			`Request path has ${maxDepth} sequential hops - each hop adds latency (network round-trip + processing time). Consider whether all layers are necessary, or if some can be combined. Every unnecessary hop adds 2-10ms to p99 latency.`
		);
	}

	if (connectedIds.has('dns')) {
		score += 1;
		passed.push(
			'DNS-based geo-routing can direct users to the nearest region, reducing cross-region latency'
		);
	} else if (placedIds.has('dns')) {
		feedback.push(
			"You placed DNS but it isn't connected to the request path. Make it the entry point (DNS → CDN/Load Balancer) so geo-routing actually applies."
		);
	} else {
		feedback.push(
			"Add DNS with geo-routing (Route 53, Cloud DNS) to direct users to the nearest region. DNS alone isn't a latency optimization, but DNS-based geo-routing can reduce cross-region latency by 50-150ms for international users."
		);
	}

	if (connectedIds.has('message-queue')) {
		score += 4;
		passed.push(
			'Message queue offloads heavy processing from the request path, keeping responses fast'
		);
	} else if (placedIds.has('message-queue')) {
		feedback.push(
			"You placed a Message Queue but it isn't connected to the request path. Connect a producer (e.g., App Server) to it so heavy work can actually be enqueued instead of blocking responses."
		);
	} else {
		feedback.push(
			'Add a Message Queue to offload heavy processing (transcoding, emails, analytics) from the synchronous request path. If your API handler does all the work inline, a 2-second transcoding job blocks the response for 2 seconds. Enqueue it and respond immediately.'
		);
	}

	if (connectedIds.has('load-balancer')) {
		score += 2;
		passed.push(
			'Load balancer enables connection pooling and keep-alive, though it adds an extra network hop'
		);
	} else if (placedIds.has('load-balancer')) {
		feedback.push(
			"You placed a Load Balancer but it isn't connected to the request path. Wire traffic through it so connection pooling and keep-alive actually apply."
		);
	} else {
		feedback.push(
			'Add a Load Balancer for connection pooling and keep-alive support. LBs add an extra hop but maintain warm connections to backends, avoiding fresh TCP+TLS handshakes (30-100ms overhead) on each request.'
		);
	}

	const hasLowLatencyStore = connectedIds.has('cache') || connectedIds.has('nosql-db');
	if (hasLowLatencyStore) {
		score += 2;
		passed.push('Using low-latency data stores (in-memory cache or NoSQL) for fast data access');
	} else if (placedIds.has('cache') || placedIds.has('nosql-db')) {
		feedback.push(
			"You placed a low-latency store (Cache/NoSQL) but it isn't connected to the request path. Connect it so your hot path actually benefits from fast reads."
		);
	} else {
		feedback.push(
			'Consider using low-latency data stores for your hot path. Redis serves reads in <1ms and DynamoDB in single-digit milliseconds, while a complex SQL JOIN can take 50-100ms. Pick the right store for your access pattern.'
		);
	}

	return { category: 'Latency', score, maxScore: 20, feedback, passed };
}

function computeMaxDepth(
	nodes: GraphNode[],
	edges: GraphEdge[]
): { depth: number; cyclic: boolean } {
	const nodeIds = new Set(nodes.map((n) => n.id));
	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const node of nodes) {
		adjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	}
	const seen = new Set<string>();
	for (const edge of edges) {
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
		if (edge.async === true) continue;
		const key = `${edge.source}->${edge.target}`;
		if (seen.has(key)) continue;
		seen.add(key);
		adjacency.get(edge.source)!.push(edge.target);
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
	}

	const dist = new Map<string, number>();
	const remaining = new Map(inDegree);
	const queue: string[] = [];

	for (const node of nodes) {
		if ((remaining.get(node.id) ?? 0) === 0) {
			queue.push(node.id);
			dist.set(node.id, 1);
		}
	}

	let head = 0;
	while (head < queue.length) {
		const id = queue[head++];
		for (const child of adjacency.get(id) ?? []) {
			const newDist = (dist.get(id) ?? 1) + 1;
			if (newDist > (dist.get(child) ?? 0)) dist.set(child, newDist);
			const newDeg = (remaining.get(child) ?? 1) - 1;
			remaining.set(child, newDeg);
			if (newDeg === 0) queue.push(child);
		}
	}

	if (head < nodes.length) {
		return { depth: nodes.length, cyclic: true };
	}
	return { depth: Math.max(0, ...dist.values()), cyclic: false };
}
