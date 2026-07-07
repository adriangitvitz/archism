import type { GraphNode, GraphEdge } from '../types/graph';
import type { NodeMetrics, NodeStatus, SimulationResult } from '../types/simulation';
import {
	UTILIZATION_WARNING,
	UTILIZATION_CRITICAL,
	LATENCY_SPIKE_THRESHOLD,
	LATENCY_SPIKE_MULTIPLIER
} from './constants';

const LOAD_BALANCING_COMPONENTS = new Set(['load-balancer', 'api-gateway']);

function getStatus(utilization: number): NodeStatus {
	if (utilization > UTILIZATION_CRITICAL) return 'critical';
	if (utilization > UTILIZATION_WARNING) return 'warning';
	return 'healthy';
}

function computeLatency(baseLatency: number, utilization: number): number {
	if (utilization > LATENCY_SPIKE_THRESHOLD) {
		return (
			baseLatency *
			(1 + Math.max(0, utilization - LATENCY_SPIKE_THRESHOLD) * LATENCY_SPIKE_MULTIPLIER)
		);
	}
	return baseLatency;
}

function sanitizeMaxQPS(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

function sanitizeReplicas(value: unknown): number {
	const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 1;
	return Math.max(1, n);
}

export function runSimulation(
	nodes: GraphNode[],
	edges: GraphEdge[],
	requestsPerSec: number
): SimulationResult {
	const warnings: string[] = [];
	const nodeMetrics = new Map<string, NodeMetrics>();
	const nodeMap = new Map(nodes.map((n) => [n.id, n]));

	const capacity = new Map<string, number>();
	for (const node of nodes) {
		capacity.set(node.id, sanitizeMaxQPS(node.maxQPS) * sanitizeReplicas(node.replicas));
	}

	const adjacency = new Map<string, string[]>();
	const syncAdjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const node of nodes) {
		adjacency.set(node.id, []);
		syncAdjacency.set(node.id, []);
		inDegree.set(node.id, 0);
	}
	const seenPairs = new Set<string>();
	const seenSyncPairs = new Set<string>();
	let validEdgeCount = 0;
	for (const edge of edges) {
		if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
		const key = `${edge.source}->${edge.target}`;
		if (!seenPairs.has(key)) {
			seenPairs.add(key);
			validEdgeCount++;
			adjacency.get(edge.source)!.push(edge.target);
			inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
		}
		if (edge.async !== true && !seenSyncPairs.has(key)) {
			seenSyncPairs.add(key);
			syncAdjacency.get(edge.source)!.push(edge.target);
		}
	}

	const hasEdges = validEdgeCount > 0;
	const entryNodes = nodes.filter(
		(n) => (inDegree.get(n.id) ?? 0) === 0 && (!hasEdges || (adjacency.get(n.id)?.length ?? 0) > 0)
	);

	const incomingQPS = new Map<string, number>();
	const qpsPerEntry = entryNodes.length > 0 ? requestsPerSec / entryNodes.length : 0;
	for (const entry of entryNodes) {
		incomingQPS.set(entry.id, qpsPerEntry);
	}

	const bottleneckNodes: string[] = [];
	const deliveredQPS = new Map<string, number>();
	const processed = new Set<string>();

	const processNode = (nodeId: string): number => {
		const node = nodeMap.get(nodeId)!;
		const data = node;
		const incoming = incomingQPS.get(nodeId) ?? 0;
		const effectiveQPS = capacity.get(nodeId) ?? 0;

		const utilization = effectiveQPS <= 0 ? (incoming > 0 ? 2 : 0) : incoming / effectiveQPS;
		const latency = computeLatency(data.latencyMs, utilization);
		const status = getStatus(utilization);
		const isBottleneck = utilization > UTILIZATION_CRITICAL;

		if (isBottleneck) bottleneckNodes.push(nodeId);

		const delivered = Math.min(incoming, effectiveQPS);
		deliveredQPS.set(nodeId, delivered);

		nodeMetrics.set(nodeId, {
			nodeId,
			incomingQPS: incoming,
			effectiveQPS,
			utilization: Math.min(utilization, 2),
			latencyMs: latency,
			status,
			isBottleneck
		});
		return delivered;
	};

	const propagateToUnprocessedChildren = (nodeId: string, output: number) => {
		const children = adjacency.get(nodeId) ?? [];
		if (children.length === 0) return;
		const isSplitter = LOAD_BALANCING_COMPONENTS.has(nodeMap.get(nodeId)!.componentId);
		const qpsToChild = isSplitter ? output / children.length : output;
		for (const childId of children) {
			if (processed.has(childId)) continue;
			incomingQPS.set(childId, (incomingQPS.get(childId) ?? 0) + qpsToChild);
		}
	};

	const remaining = new Map(inDegree);
	const queue: string[] = entryNodes.map((n) => n.id);
	let head = 0;

	while (head < queue.length) {
		const nodeId = queue[head++];
		if (processed.has(nodeId)) continue;
		processed.add(nodeId);

		const output = processNode(nodeId);

		const children = adjacency.get(nodeId) ?? [];
		const isSplitter = LOAD_BALANCING_COMPONENTS.has(nodeMap.get(nodeId)!.componentId);
		const qpsToChild = isSplitter && children.length > 0 ? output / children.length : output;

		for (const childId of children) {
			incomingQPS.set(childId, (incomingQPS.get(childId) ?? 0) + qpsToChild);

			const newDeg = (remaining.get(childId) ?? 1) - 1;
			remaining.set(childId, newDeg);
			if (newDeg === 0) {
				queue.push(childId);
			}
		}
	}

	const unresolved = nodes.filter((n) => !processed.has(n.id) && (inDegree.get(n.id) ?? 0) > 0);

	if (unresolved.length > 0) {
		const unresolvedSet = new Set(unresolved.map((n) => n.id));
		const outDeg = new Map<string, number>();
		const revAdj = new Map<string, string[]>();
		for (const id of unresolvedSet) {
			outDeg.set(id, 0);
			revAdj.set(id, []);
		}
		for (const id of unresolvedSet) {
			for (const child of adjacency.get(id) ?? []) {
				if (unresolvedSet.has(child)) {
					outDeg.set(id, (outDeg.get(id) ?? 0) + 1);
					revAdj.get(child)!.push(id);
				}
			}
		}
		const peelQueue: string[] = [];
		for (const [id, deg] of outDeg) {
			if (deg === 0) peelQueue.push(id);
		}
		const peeled = new Set<string>();
		let peelHead = 0;
		while (peelHead < peelQueue.length) {
			const id = peelQueue[peelHead++];
			peeled.add(id);
			for (const pred of revAdj.get(id) ?? []) {
				const newDeg = (outDeg.get(pred) ?? 1) - 1;
				outDeg.set(pred, newDeg);
				if (newDeg === 0) peelQueue.push(pred);
			}
		}
		const cycleIds = unresolved.filter((n) => !peeled.has(n.id)).map((n) => n.id);
		const downstreamIds = unresolved.filter((n) => peeled.has(n.id)).map((n) => n.id);

		if (cycleIds.length > 0) {
			warnings.push(
				`Cycle detected involving node(s): ${cycleIds.join(', ')}. Processing with accumulated QPS.`
			);
		}
		if (downstreamIds.length > 0) {
			warnings.push(
				`Node(s) downstream of a cycle: ${downstreamIds.join(', ')}. Traffic propagated after resolving the cycle.`
			);
		}

		const cycleSet = new Set(cycleIds);
		const cycleQueue: string[] = cycleIds.filter((id) => (incomingQPS.get(id) ?? 0) > 0);
		const processCycleMember = (nodeId: string) => {
			processed.add(nodeId);
			const output = processNode(nodeId);
			const children = adjacency.get(nodeId) ?? [];
			if (children.length === 0) return;
			const isSplitter = LOAD_BALANCING_COMPONENTS.has(nodeMap.get(nodeId)!.componentId);
			const qpsToChild = isSplitter ? output / children.length : output;
			for (const childId of children) {
				if (processed.has(childId)) continue;
				incomingQPS.set(childId, (incomingQPS.get(childId) ?? 0) + qpsToChild);
				if (cycleSet.has(childId)) cycleQueue.push(childId);
			}
		};
		let cycleHead = 0;
		while (cycleHead < cycleQueue.length) {
			const nodeId = cycleQueue[cycleHead++];
			if (processed.has(nodeId)) continue;
			processCycleMember(nodeId);
		}

		for (const nodeId of cycleIds) {
			if (!processed.has(nodeId)) processCycleMember(nodeId);
		}

		const downstreamSet = new Set(downstreamIds);
		const dsInDeg = new Map<string, number>();
		for (const id of downstreamSet) dsInDeg.set(id, 0);
		for (const id of downstreamSet) {
			for (const child of adjacency.get(id) ?? []) {
				if (downstreamSet.has(child)) {
					dsInDeg.set(child, (dsInDeg.get(child) ?? 0) + 1);
				}
			}
		}
		const dsQueue: string[] = [];
		for (const [id, deg] of dsInDeg) {
			if (deg === 0) dsQueue.push(id);
		}
		let dsHead = 0;
		while (dsHead < dsQueue.length) {
			const nodeId = dsQueue[dsHead++];
			if (processed.has(nodeId)) continue;
			processed.add(nodeId);
			const output = processNode(nodeId);
			propagateToUnprocessedChildren(nodeId, output);
			for (const childId of adjacency.get(nodeId) ?? []) {
				if (!downstreamSet.has(childId)) continue;
				const newDeg = (dsInDeg.get(childId) ?? 1) - 1;
				dsInDeg.set(childId, newDeg);
				if (newDeg === 0) dsQueue.push(childId);
			}
		}
	}

	for (const node of nodes) {
		if (!nodeMetrics.has(node.id)) {
			nodeMetrics.set(node.id, {
				nodeId: node.id,
				incomingQPS: 0,
				effectiveQPS: capacity.get(node.id) ?? 0,
				utilization: 0,
				latencyMs: node.latencyMs,
				status: 'idle',
				isBottleneck: false
			});
		}
	}

	const totalLatencyMs = computeLongestPathLatency(
		entryNodes.map((n) => n.id),
		syncAdjacency,
		nodeMetrics
	);

	let throughput: number;
	if (nodes.length === 0 || entryNodes.length === 0) {
		throughput = 0;
	} else if (bottleneckNodes.length > 0) {
		throughput = Math.min(
			requestsPerSec,
			...bottleneckNodes.map((id) => deliveredQPS.get(id) ?? 0)
		);
	} else {
		throughput = requestsPerSec;
	}

	return {
		nodeMetrics,
		totalLatencyMs,
		bottleneckNodes,
		throughput,
		timestamp: Date.now(),
		warnings
	};
}

function computeLongestPathLatency(
	entryIds: string[],
	syncAdjacency: Map<string, string[]>,
	metrics: Map<string, NodeMetrics>
): number {
	if (entryIds.length === 0) return 0;

	const reachable = new Set<string>(entryIds);
	const bfs: string[] = [...entryIds];
	let bfsHead = 0;
	while (bfsHead < bfs.length) {
		const id = bfs[bfsHead++];
		for (const child of syncAdjacency.get(id) ?? []) {
			if (!reachable.has(child)) {
				reachable.add(child);
				bfs.push(child);
			}
		}
	}

	const inDeg = new Map<string, number>();
	for (const id of reachable) inDeg.set(id, 0);
	for (const id of reachable) {
		for (const child of syncAdjacency.get(id) ?? []) {
			if (reachable.has(child)) {
				inDeg.set(child, (inDeg.get(child) ?? 0) + 1);
			}
		}
	}

	const dist = new Map<string, number>();
	const queue: string[] = [];
	for (const id of entryIds) {
		queue.push(id);
		dist.set(id, metrics.get(id)?.latencyMs ?? 0);
	}

	const done = new Set<string>();
	let head = 0;
	while (head < queue.length) {
		const id = queue[head++];
		if (done.has(id)) continue;
		done.add(id);

		const currentDist = dist.get(id) ?? 0;
		for (const childId of syncAdjacency.get(id) ?? []) {
			if (!reachable.has(childId)) continue;
			const childLatency = metrics.get(childId)?.latencyMs ?? 0;
			const newDist = currentDist + childLatency;
			if (newDist > (dist.get(childId) ?? 0)) {
				dist.set(childId, newDist);
			}
			const newDeg = (inDeg.get(childId) ?? 1) - 1;
			inDeg.set(childId, newDeg);
			if (newDeg === 0) {
				queue.push(childId);
			}
		}
	}

	return dist.size === 0 ? 0 : Math.max(0, ...dist.values());
}
