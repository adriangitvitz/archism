import type { GraphNode, GraphEdge } from '../../types/graph';
import type { CategoryScore, ScoringGraph } from '../../types/scoring';

export function scoreTradeoffs(
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

	const hasCache = connectedIds.has('cache');
	const hasDB = connectedIds.has('sql-db') || connectedIds.has('nosql-db');
	if (hasCache && hasDB) {
		score += 3;
		passed.push('Read/write separation via cache + database - optimizes each path independently');
	} else if (placedIds.has('cache') && (placedIds.has('sql-db') || placedIds.has('nosql-db'))) {
		feedback.push(
			"You placed a Cache and a Database, but they aren't both connected to the request path. Wire them in (App Server → Cache for reads, App Server → DB for writes) to get credit for read/write separation."
		);
	} else {
		feedback.push(
			'Separate your read and write paths (Cache for reads, DB for writes). This is a core system design pattern - reads and writes have different scaling characteristics. Reads can be served from cheap, fast caches while writes go to durable storage. This lets you optimize each path independently.'
		);
	}

	const polyglotTypes = [
		'sql-db',
		'nosql-db',
		'timeseries-db',
		'graph-db',
		'search',
		'object-storage'
	];
	const storageTypes = new Set<string>();
	for (const n of connectedNodes) {
		if (polyglotTypes.includes(n.componentId)) storageTypes.add(n.componentId);
	}
	if (storageTypes.size >= 2) {
		score += 3;
		passed.push(
			'Polyglot persistence - using ' +
				storageTypes.size +
				' distinct storage types suited to different access patterns'
		);
	} else if (storageTypes.size === 1) {
		score += 1;
		feedback.push(
			'Consider polyglot persistence - using multiple storage technologies suited to different access patterns. For example, SQL for transactional data, NoSQL for high-throughput key-value access, and object storage for blobs. One storage type rarely fits all workloads efficiently.'
		);
	} else {
		feedback.push(
			'No connected durable storage in your design - add at least one. Real systems benefit from polyglot persistence: different storage technologies (SQL, NoSQL, object storage) suited to different access patterns and consistency requirements.'
		);
	}

	if (connectedIds.has('message-queue')) {
		score += 3;
		passed.push(
			'Message queue decouples services - trading immediate consistency for resilience and throughput'
		);
	} else if (placedIds.has('message-queue')) {
		feedback.push(
			"You placed a Message Queue but it isn't connected to the request path. Connect producers and consumers to it so the decoupling actually happens."
		);
	} else {
		feedback.push(
			'Add a Message Queue (Kafka, SQS, RabbitMQ) to decouple synchronous dependencies. This is a key tradeoff: you accept eventual consistency in exchange for much higher resilience and throughput. If Service B goes down, Service A can still enqueue work instead of failing.'
		);
	}

	const hasDefense = connectedIds.has('rate-limiter') || connectedIds.has('api-gateway');
	if (hasDefense) {
		score += 3;
		passed.push(
			'Defense in depth with rate limiting / API gateway - protects against abuse and overload'
		);
	} else if (placedIds.has('rate-limiter') || placedIds.has('api-gateway')) {
		feedback.push(
			"You placed an API Gateway / Rate Limiter but it isn't connected to the request path. Put it in front of your services so it can actually filter traffic."
		);
	} else {
		feedback.push(
			'Add an API Gateway or Rate Limiter for security and traffic control. This is a latency-vs-safety tradeoff: each request pays ~1-5ms extra for protection against DDoS, abuse, and cascading failures. Without it, one bad actor can bring down your entire system.'
		);
	}

	const uniqueCategories = new Set(connectedNodes.map((n) => n.category));
	if (uniqueCategories.size >= 4) {
		score += 3;
		passed.push(
			'Design covers ' + uniqueCategories.size + ' architectural layers - shows breadth of thinking'
		);
	} else if (uniqueCategories.size >= 3) {
		score += 1;
		feedback.push(
			'Your connected design covers ' +
				uniqueCategories.size +
				" categories but is missing important layers. A well-rounded system design typically spans networking (LB, CDN), compute (app servers), storage (DB, cache), and messaging (queues) - consider which layers you're missing."
		);
	} else {
		feedback.push(
			'Your connected design only covers ' +
				uniqueCategories.size +
				" category/categories - production systems need breadth. Add (and connect) components from networking, compute, storage, and messaging categories to show you've considered the full picture."
		);
	}

	const hasAuthLayer =
		connectedIds.has('auth-service') ||
		(connectedIds.has('api-gateway') && connectedIds.has('rate-limiter'));
	if (hasAuthLayer) {
		score += 3;
		passed.push('Security layer (Auth Service / API Gateway + Rate Limiter) protects the system');
	} else if (
		placedIds.has('auth-service') ||
		(placedIds.has('api-gateway') && placedIds.has('rate-limiter'))
	) {
		feedback.push(
			"You placed security components (Auth Service / API Gateway + Rate Limiter) but they aren't connected to the request path. Wire them in so requests are actually authenticated and throttled."
		);
	} else {
		feedback.push(
			'Add an Auth Service or security layer (API Gateway + Rate Limiter) to your design. Authentication and authorization are non-negotiable for any user-facing system. Centralizing auth into a dedicated service prevents security logic from being duplicated across microservices.'
		);
	}

	if (connectedIds.has('monitoring')) {
		score += 2;
		passed.push(
			'Monitoring shows awareness that you need observability to manage tradeoffs in production'
		);
	} else if (placedIds.has('monitoring')) {
		feedback.push(
			"You placed Monitoring but it isn't connected to anything. Connect your services to it so metrics actually flow."
		);
	} else {
		feedback.push(
			"Add Monitoring to your design. In production, every tradeoff you make (consistency vs availability, cost vs performance) needs to be measured and validated. Without metrics, you're flying blind - you won't know if your cache hit rate justifies its cost or if your queue is creating unacceptable delays."
		);
	}

	return { category: 'Trade-offs', score, maxScore: 20, feedback, passed };
}
