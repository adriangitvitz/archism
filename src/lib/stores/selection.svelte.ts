export class SelectionStore {
	nodeId = $state<string | null>(null);
	edgeId = $state<string | null>(null);

	selectNode(id: string | null): void {
		this.nodeId = id;
		if (id) this.edgeId = null;
	}

	selectEdge(id: string | null): void {
		this.edgeId = id;
		if (id) this.nodeId = null;
	}

	clear(): void {
		this.nodeId = null;
		this.edgeId = null;
	}
}
