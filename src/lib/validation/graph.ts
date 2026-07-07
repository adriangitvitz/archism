import type { GraphEdge, GraphNode } from '../types/graph';
import type { ScoringGraph } from '../types/scoring';

export function buildScoringGraph(nodes: GraphNode[], edges: GraphEdge[]): ScoringGraph {
	const nodeIds = new Set(nodes.map((n) => n.id));
	const adjacency = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const n of nodes) {
		adjacency.set(n.id, []);
		inDegree.set(n.id, 0);
	}

	const seen = new Set<string>();
	let edgeCount = 0;
	for (const e of edges) {
		if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) continue;
		const key = `${e.source}->${e.target}`;
		if (seen.has(key)) continue;
		seen.add(key);
		edgeCount++;
		adjacency.get(e.source)!.push(e.target);
		inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
	}

	const reachable = new Set<string>();
	if (edgeCount === 0) {
		if (nodes.length === 1) reachable.add(nodes[0].id);
	} else {
		const queue: string[] = [];
		for (const n of nodes) {
			if ((inDegree.get(n.id) ?? 0) === 0 && (adjacency.get(n.id)?.length ?? 0) > 0) {
				queue.push(n.id);
				reachable.add(n.id);
			}
		}
		let head = 0;
		while (head < queue.length) {
			const id = queue[head++];
			for (const child of adjacency.get(id) ?? []) {
				if (!reachable.has(child)) {
					reachable.add(child);
					queue.push(child);
				}
			}
		}
	}

	return { adjacency, reachable };
}
