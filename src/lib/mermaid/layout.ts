import type { DesignEdge, DesignNode } from '$lib/types/graph';

const COL_WIDTH = 260;
const ROW_HEIGHT = 130;

export function autoLayout(nodes: DesignNode[], edges: DesignEdge[]): void {
	const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
	const adjacency = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
	for (const e of edges) {
		if (!adjacency.has(e.source) || !inDegree.has(e.target) || e.source === e.target) continue;
		adjacency.get(e.source)!.push(e.target);
		inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
	}

	const depth = new Map<string, number>();
	const queue: string[] = [];
	for (const n of nodes) {
		if ((inDegree.get(n.id) ?? 0) === 0) {
			depth.set(n.id, 0);
			queue.push(n.id);
		}
	}
	let head = 0;
	while (head < queue.length) {
		const id = queue[head++];
		const d = depth.get(id)!;
		for (const child of adjacency.get(id) ?? []) {
			if (!depth.has(child) || depth.get(child)! < d + 1) {
				depth.set(child, d + 1);
				if (!queue.includes(child)) queue.push(child);
			}
		}
	}

	const rowByDepth = new Map<number, number>();
	for (const n of nodes) {
		const d = depth.get(n.id) ?? 0;
		const row = rowByDepth.get(d) ?? 0;
		rowByDepth.set(d, row + 1);
		n.position = { x: d * COL_WIDTH, y: row * ROW_HEIGHT };
	}
}
