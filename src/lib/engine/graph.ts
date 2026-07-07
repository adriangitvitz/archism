import type { SimEdgeSpec, SimNodeSpec } from './types';

export interface CompiledGraph {
	order: string[];

	adjacency: Map<string, string[]>;
	inEdges: Map<string, string[]>;
	outEdges: Map<string, string[]>;
	entryIds: string[];
	cycleIds: string[];
	warnings: string[];
}

export function compileGraph(nodes: SimNodeSpec[], edges: SimEdgeSpec[]): CompiledGraph {
	const warnings: string[] = [];
	const nodeIds = new Set(nodes.map((n) => n.id));
	const adjacency = new Map<string, string[]>();
	const inEdges = new Map<string, string[]>();
	const outEdges = new Map<string, string[]>();
	const inDegree = new Map<string, number>();
	for (const n of nodes) {
		adjacency.set(n.id, []);
		inEdges.set(n.id, []);
		outEdges.set(n.id, []);
		inDegree.set(n.id, 0);
	}

	const seenPairs = new Set<string>();
	let validEdgeCount = 0;
	for (const e of edges) {
		if (!nodeIds.has(e.source) || !nodeIds.has(e.target) || e.source === e.target) continue;
		const key = `${e.source}->${e.target}`;
		if (seenPairs.has(key)) continue;
		seenPairs.add(key);
		validEdgeCount++;
		adjacency.get(e.source)!.push(e.target);
		inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
		inEdges.get(e.target)!.push(e.id);
		outEdges.get(e.source)!.push(e.id);
	}

	const hasEdges = validEdgeCount > 0;
	const entryIds = nodes
		.filter(
			(n) =>
				(inDegree.get(n.id) ?? 0) === 0 && (!hasEdges || (adjacency.get(n.id)?.length ?? 0) > 0)
		)
		.map((n) => n.id);

	const order: string[] = [];
	const remaining = new Map(inDegree);
	const queue = [...entryIds];

	for (const n of nodes) {
		if ((inDegree.get(n.id) ?? 0) === 0 && !queue.includes(n.id)) queue.push(n.id);
	}
	const processed = new Set<string>();
	let head = 0;
	while (head < queue.length) {
		const id = queue[head++];
		if (processed.has(id)) continue;
		processed.add(id);
		order.push(id);
		for (const child of adjacency.get(id) ?? []) {
			const deg = (remaining.get(child) ?? 1) - 1;
			remaining.set(child, deg);
			if (deg === 0) queue.push(child);
		}
	}

	const unresolved = nodes.filter((n) => !processed.has(n.id));
	const cycleIds: string[] = [];
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
		for (const [id, deg] of outDeg) if (deg === 0) peelQueue.push(id);
		const peeled = new Set<string>();
		let peelHead = 0;
		while (peelHead < peelQueue.length) {
			const id = peelQueue[peelHead++];
			peeled.add(id);
			for (const pred of revAdj.get(id) ?? []) {
				const deg = (outDeg.get(pred) ?? 1) - 1;
				outDeg.set(pred, deg);
				if (deg === 0) peelQueue.push(pred);
			}
		}
		for (const n of unresolved) if (!peeled.has(n.id)) cycleIds.push(n.id);
		if (cycleIds.length > 0) {
			warnings.push(`Cycle detected involving node(s): ${cycleIds.join(', ')}.`);
		}

		for (const n of unresolved) if (!peeled.has(n.id)) order.push(n.id);
		for (const n of unresolved) if (peeled.has(n.id)) order.push(n.id);
	}

	return { order, adjacency, inEdges, outEdges, entryIds, cycleIds, warnings };
}
