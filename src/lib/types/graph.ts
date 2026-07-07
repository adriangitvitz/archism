import type { ComponentCategory } from './component';
import type { Provider } from './provider';

export interface GraphNode {
	id: string;
	componentId: string;
	label?: string;
	category: ComponentCategory;
	maxQPS: number;
	latencyMs: number;
	scalable: boolean;
	stateful: boolean;
	replicas: number;
}

export interface GraphEdge {
	id: string;
	source: string;
	target: string;

	async?: boolean;
}

export type EdgeKind = 'sync' | 'async' | 'pubsub';
export type PortSide = 'L' | 'R' | 'T' | 'B';

export interface PubSubNodeConfig {
	role: 'topic' | 'subscriber' | 'dlq';

	group?: string;
	partitions?: number;
	retentionMessages?: number;
	failureFraction?: number;
	dlqNodeId?: string;
	backpressure?: boolean;
}

export interface AutoscaleConfig {
	min: number;
	max: number;
	targetUtil: number;
	scaleOutDelaySec: number;
	scaleInDelaySec: number;
	warmupSec: number;
}

export interface CacheConfig {
	hitRatio: number;
	warmupSec?: number;
}

export interface DesignNodeConfig {
	replicas?: number;
	maxQPSOverride?: number;

	latencyMsOverride?: number;

	autoscale?: boolean | AutoscaleConfig;

	entryRps?: number;
	timeoutMs?: number;
	cache?: CacheConfig;
	pubsub?: PubSubNodeConfig;
}

export interface DesignNode {
	id: string;
	componentId: string;
	label: string;
	position: { x: number; y: number };
	groupId?: string;
	config: DesignNodeConfig;
}

export interface RetryConfig {
	max: number;
	backoffMs: number;
}

export interface BreakerConfig {
	errorThreshold: number;
	cooldownSec: number;
}

export interface DesignEdge {
	id: string;
	source: string;
	target: string;
	kind: EdgeKind;
	label?: string;
	protocol?: string;

	weight?: number;
	retry?: RetryConfig;
	breaker?: BreakerConfig;
	poolSize?: number;
	ports?: { sourceSide: PortSide; targetSide: PortSide };
}

export interface DesignGroup {
	id: string;
	label: string;
	icon?: string;
	parentId?: string;
}

export interface SloTargetConfig {
	targetLatencyMs: number;
	targetAvailability: number;
}

export interface DesignDoc {
	schemaVersion: 1;
	id: string;
	name: string;
	provider: Provider;
	slo?: SloTargetConfig;
	nodes: DesignNode[];
	edges: DesignEdge[];
	groups: DesignGroup[];
	meta: { createdAt: string; updatedAt: string; notes?: string };
}

const PROVIDERS = new Set(['aws', 'gcp', 'azure', 'baremetal', 'generic']);
const EDGE_KINDS = new Set(['sync', 'async', 'pubsub']);

export function validateDesignDoc(
	value: unknown
): { ok: true; doc: DesignDoc } | { ok: false; error: string } {
	if (typeof value !== 'object' || value === null)
		return { ok: false, error: 'doc must be an object' };
	const doc = value as Record<string, unknown>;
	if (doc.schemaVersion !== 1) return { ok: false, error: 'unsupported schemaVersion' };
	if (typeof doc.id !== 'string' || doc.id.length === 0) return { ok: false, error: 'missing id' };
	if (typeof doc.name !== 'string') return { ok: false, error: 'missing name' };
	if (!PROVIDERS.has(doc.provider as string)) return { ok: false, error: 'invalid provider' };
	if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges) || !Array.isArray(doc.groups))
		return { ok: false, error: 'nodes/edges/groups must be arrays' };

	const nodeIds = new Set<string>();
	for (const n of doc.nodes as unknown[]) {
		if (typeof n !== 'object' || n === null) return { ok: false, error: 'invalid node' };
		const node = n as Record<string, unknown>;
		if (
			typeof node.id !== 'string' ||
			typeof node.componentId !== 'string' ||
			typeof node.label !== 'string'
		)
			return { ok: false, error: 'node missing id/componentId/label' };
		if (nodeIds.has(node.id)) return { ok: false, error: `duplicate node id ${node.id}` };
		nodeIds.add(node.id);
		const pos = node.position as Record<string, unknown> | undefined;
		if (typeof pos?.x !== 'number' || typeof pos?.y !== 'number')
			return { ok: false, error: `node ${node.id} missing position` };
		if (typeof node.config !== 'object' || node.config === null)
			return { ok: false, error: `node ${node.id} missing config` };
	}

	const groupIds = new Set<string>();
	for (const g of doc.groups as unknown[]) {
		if (typeof g !== 'object' || g === null) return { ok: false, error: 'invalid group' };
		const group = g as Record<string, unknown>;
		if (typeof group.id !== 'string' || typeof group.label !== 'string')
			return { ok: false, error: 'group missing id/label' };
		if (groupIds.has(group.id)) return { ok: false, error: `duplicate group id ${group.id}` };
		groupIds.add(group.id);
	}

	const edgeIds = new Set<string>();
	for (const e of doc.edges as unknown[]) {
		if (typeof e !== 'object' || e === null) return { ok: false, error: 'invalid edge' };
		const edge = e as Record<string, unknown>;
		if (
			typeof edge.id !== 'string' ||
			typeof edge.source !== 'string' ||
			typeof edge.target !== 'string'
		)
			return { ok: false, error: 'edge missing id/source/target' };
		if (edgeIds.has(edge.id)) return { ok: false, error: `duplicate edge id ${edge.id}` };
		edgeIds.add(edge.id);
		if (!EDGE_KINDS.has(edge.kind as string))
			return { ok: false, error: `edge ${edge.id} has invalid kind` };
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target))
			return { ok: false, error: `edge ${edge.id} references unknown node` };
	}

	for (const n of doc.nodes as { id: string; groupId?: unknown }[]) {
		if (n.groupId !== undefined && !groupIds.has(n.groupId as string))
			return { ok: false, error: `node ${n.id} references unknown group` };
	}

	const meta = doc.meta as Record<string, unknown> | undefined;
	if (typeof meta?.createdAt !== 'string' || typeof meta?.updatedAt !== 'string')
		return { ok: false, error: 'missing meta timestamps' };

	return { ok: true, doc: value as DesignDoc };
}
