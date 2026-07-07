import type { Edge, Node } from '@xyflow/svelte';
import type {
	BreakerConfig,
	DesignDoc,
	DesignEdge,
	DesignGroup,
	DesignNode,
	DesignNodeConfig,
	EdgeKind,
	RetryConfig,
	SloTargetConfig
} from '$lib/types/graph';
import type { Provider } from '$lib/types/provider';
import { getComponentById } from '$lib/catalog/components';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface ComponentNodeData extends Record<string, unknown> {
	componentId: string;
	label: string;
	config: DesignNodeConfig;
}

export interface FlowEdgeData extends Record<string, unknown> {
	kind: EdgeKind;
	label?: string;
	protocol?: string;
	weight?: number;
	retry?: RetryConfig;
	breaker?: BreakerConfig;
}

interface Snapshot {
	nodes: Node[];
	edges: Edge[];
	groups: DesignGroup[];
}

const MAX_HISTORY = 50;
const AUTOSAVE_DEBOUNCE_MS = 2000;

const ASYNC_SOURCES = new Set(['message-queue', 'task-scheduler']);
const PUBSUB_SOURCES = new Set(['pub-sub']);

let edgeSeq = 0;

export class DesignStore {
	id = $state('');
	name = $state('');
	provider = $state<Provider>('generic');
	slo = $state<SloTargetConfig | undefined>(undefined);
	groups = $state<DesignGroup[]>([]);
	private createdAt = '';

	nodes = $state.raw<Node[]>([]);
	edges = $state.raw<Edge[]>([]);

	saveState = $state<SaveState>('saved');

	readOnly = false;

	conflictWarning = $state(false);

	private undoStack: Snapshot[] = [];
	private redoStack: Snapshot[] = [];
	canUndo = $state(false);
	canRedo = $state(false);

	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private lastSavedUpdatedAt = '';

	graphVersion = $state(0);

	load(doc: DesignDoc): void {
		this.id = doc.id;
		this.name = doc.name;
		this.provider = doc.provider;
		this.slo = doc.slo;
		this.groups = doc.groups;
		this.createdAt = doc.meta.createdAt;
		this.lastSavedUpdatedAt = doc.meta.updatedAt;
		this.nodes = doc.nodes.map(docNodeToFlow);
		this.edges = doc.edges.map(docEdgeToFlow);
		this.undoStack = [];
		this.redoStack = [];
		this.canUndo = false;
		this.canRedo = false;
		this.saveState = 'saved';
		this.graphVersion++;
	}

	toDoc(): DesignDoc {
		return {
			schemaVersion: 1,
			id: this.id,
			name: this.name,
			provider: this.provider,
			slo: this.slo,
			nodes: this.nodes.filter((n) => n.type === 'component').map(flowNodeToDoc),
			edges: this.edges.map(flowEdgeToDoc),
			groups: this.groups,
			meta: { createdAt: this.createdAt, updatedAt: this.lastSavedUpdatedAt }
		};
	}

	addNode(componentId: string, position: { x: number; y: number }): string | null {
		const spec = getComponentById(componentId);
		if (!spec) return null;
		this.pushHistory();
		const id = `${componentId}-${crypto.randomUUID().slice(0, 8)}`;
		const data: ComponentNodeData = { componentId, label: spec.label, config: {} };
		this.nodes = [...this.nodes, { id, type: 'component', position, data }];
		this.touch();
		return id;
	}

	createEdge(
		source: string,
		target: string,
		sourceHandle?: string | null,
		targetHandle?: string | null
	): Edge {
		const sourceNode = this.nodes.find((n) => n.id === source);
		const componentId = (sourceNode?.data as ComponentNodeData | undefined)?.componentId ?? '';
		const kind: EdgeKind = PUBSUB_SOURCES.has(componentId)
			? 'pubsub'
			: ASYNC_SOURCES.has(componentId)
				? 'async'
				: 'sync';
		const data: FlowEdgeData = { kind };
		return {
			id: `e-${Date.now().toString(36)}-${edgeSeq++}`,
			source,
			target,
			sourceHandle: sourceHandle ?? undefined,
			targetHandle: targetHandle ?? undefined,
			type: 'flow',
			data
		};
	}

	updateNodeData(id: string, patch: Partial<ComponentNodeData>): void {
		this.pushHistory();
		this.nodes = this.nodes.map((n) =>
			n.id === id ? { ...n, data: { ...(n.data as ComponentNodeData), ...patch } } : n
		);
		this.touch();
	}

	updateNodeConfig(id: string, patch: Partial<DesignNodeConfig>): void {
		const node = this.nodes.find((n) => n.id === id);
		if (!node) return;
		const data = node.data as ComponentNodeData;
		this.updateNodeData(id, { config: { ...data.config, ...patch } });
	}

	updateEdgeData(id: string, patch: Partial<FlowEdgeData>): void {
		this.pushHistory();
		this.edges = this.edges.map((e) =>
			e.id === id ? { ...e, data: { ...(e.data as FlowEdgeData), ...patch } } : e
		);
		this.touch();
	}

	deleteNode(id: string): void {
		this.pushHistory();
		this.nodes = this.nodes.filter((n) => n.id !== id);
		this.edges = this.edges.filter((e) => e.source !== id && e.target !== id);
		this.touch();
	}

	deleteEdge(id: string): void {
		this.pushHistory();
		this.edges = this.edges.filter((e) => e.id !== id);
		this.touch();
	}

	rename(name: string): void {
		this.name = name;
		this.touch();
	}

	setProvider(provider: Provider): void {
		this.provider = provider;
		this.touch();
	}

	setSlo(slo: SloTargetConfig | undefined): void {
		this.slo = slo;
		this.touch(false);
	}

	markDirty(structural = false): void {
		this.touch(structural);
	}

	beginGesture(): void {
		this.pushHistory();
	}

	private snapshot(): Snapshot {
		return { nodes: this.nodes, edges: this.edges, groups: this.groups };
	}

	private pushHistory(): void {
		this.undoStack.push(this.snapshot());
		if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
		this.redoStack = [];
		this.updateHistoryFlags();
	}

	undo(): void {
		const prev = this.undoStack.pop();
		if (!prev) return;
		this.redoStack.push(this.snapshot());
		this.restore(prev);
	}

	redo(): void {
		const next = this.redoStack.pop();
		if (!next) return;
		this.undoStack.push(this.snapshot());
		this.restore(next);
	}

	private restore(s: Snapshot): void {
		this.nodes = s.nodes;
		this.edges = s.edges;
		this.groups = s.groups;
		this.updateHistoryFlags();
		this.touch();
	}

	private updateHistoryFlags(): void {
		this.canUndo = this.undoStack.length > 0;
		this.canRedo = this.redoStack.length > 0;
	}

	private touch(structural = true): void {
		if (structural) this.graphVersion++;
		if (this.readOnly) return;
		this.saveState = 'dirty';
		if (this.saveTimer) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => void this.save(), AUTOSAVE_DEBOUNCE_MS);
	}

	async save(): Promise<void> {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		this.saveState = 'saving';
		try {
			const res = await fetch(`/api/designs/${this.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(this.toDoc())
			});
			if (!res.ok) throw new Error(`save failed: ${res.status}`);
			const body = (await res.json()) as { updatedAt: string; previousUpdatedAt: string };
			if (this.lastSavedUpdatedAt && body.previousUpdatedAt !== this.lastSavedUpdatedAt) {
				this.conflictWarning = true;
			}
			this.lastSavedUpdatedAt = body.updatedAt;
			this.saveState = this.saveState === 'saving' ? 'saved' : this.saveState;
		} catch {
			this.saveState = 'error';
		}
	}
}

function docNodeToFlow(n: DesignNode): Node {
	const data: ComponentNodeData = { componentId: n.componentId, label: n.label, config: n.config };
	return { id: n.id, type: 'component', position: n.position, data };
}

function flowNodeToDoc(n: Node): DesignNode {
	const data = n.data as ComponentNodeData;
	return {
		id: n.id,
		componentId: data.componentId,
		label: data.label,
		position: { x: n.position.x, y: n.position.y },
		config: data.config
	};
}

function docEdgeToFlow(e: DesignEdge): Edge {
	const data: FlowEdgeData = {
		kind: e.kind,
		label: e.label,
		protocol: e.protocol,
		weight: e.weight,
		retry: e.retry,
		breaker: e.breaker
	};
	return { id: e.id, source: e.source, target: e.target, type: 'flow', data };
}

function flowEdgeToDoc(e: Edge): DesignEdge {
	const data = (e.data ?? { kind: 'sync' }) as FlowEdgeData;
	return {
		id: e.id,
		source: e.source,
		target: e.target,
		kind: data.kind,
		label: data.label,
		protocol: data.protocol,
		weight: data.weight,
		retry: data.retry,
		breaker: data.breaker
	};
}
