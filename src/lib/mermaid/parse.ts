import type {
	DesignDoc,
	DesignEdge,
	DesignGroup,
	DesignNode,
	EdgeKind,
	PortSide
} from '$lib/types/graph';
import type { Provider } from '$lib/types/provider';
import { getComponentById } from '$lib/catalog/components';
import { componentIdForIcon } from './icons';
import { autoLayout } from './layout';
import { parseFlowchart } from './flowchart';

export interface ParseError {
	line: number;
	message: string;
}

export interface ParseResult {
	doc: Omit<DesignDoc, 'id' | 'meta'> | null;
	errors: ParseError[];
	warnings: string[];
}

const GROUP_RE = /^group\s+([A-Za-z0-9_-]+)\(([^)]*)\)\[([^\]]*)\](?:\s+in\s+([A-Za-z0-9_-]+))?$/;
const SERVICE_RE =
	/^service\s+([A-Za-z0-9_-]+)\(([^)]*)\)\[([^\]]*)\](?:\s+in\s+([A-Za-z0-9_-]+))?$/;
const JUNCTION_RE = /^junction\s+([A-Za-z0-9_-]+)(?:\s+in\s+([A-Za-z0-9_-]+))?$/;
const EDGE_RE =
	/^([A-Za-z0-9_-]+)(?:\{group\})?:([LRTB])\s*(<)?--(>)?\s*([LRTB]):([A-Za-z0-9_-]+)(?:\{group\})?$/;
const META_RE = /^%%\s*@meta\s+(node|edge|group|doc)\s+(\S+)\s+(\{.*\})$/;

interface RawNode {
	mid: string;
	icon: string;
	title: string;
	groupMid?: string;
	line: number;
}
interface RawEdge {
	sourceMid: string;
	targetMid: string;
	sourceSide: PortSide;
	targetSide: PortSide;
	reversed: boolean;
	line: number;
}

const OTHER_DIAGRAM_TYPES =
	/^(sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|journey|mindmap|timeline|quadrantChart|gitGraph|C4Context|sankey|xychart|block|kanban|requirement)/;

export function parseMermaid(text: string): ParseResult {
	for (const rawLine of text.split('\n')) {
		const line = rawLine.trim();
		if (line === '' || line.startsWith('%%')) continue;
		if (/^(flowchart|graph)\b/.test(line)) return parseFlowchart(text);
		const other = line.match(OTHER_DIAGRAM_TYPES);
		if (other) {
			return {
				doc: null,
				errors: [
					{
						line: 1,
						message: `Unsupported diagram type "${other[1]}" - only architecture-beta and flowchart diagrams can be imported.`
					}
				],
				warnings: []
			};
		}
		break;
	}
	return parseArchitecture(text);
}

function parseArchitecture(text: string): ParseResult {
	const errors: ParseError[] = [];
	const warnings: string[] = [];
	const rawGroups = new Map<string, { title: string; parentMid?: string }>();
	const rawNodes = new Map<string, RawNode>();
	const rawEdges: RawEdge[] = [];
	const nodeMeta = new Map<string, Record<string, unknown>>();
	const edgeMeta = new Map<string, Record<string, unknown>>();
	const groupMeta = new Map<string, Record<string, unknown>>();
	let docMeta: Record<string, unknown> = {};
	let sawHeader = false;

	const lines = text.split('\n');
	lines.forEach((rawLine, i) => {
		const lineNo = i + 1;
		const line = rawLine.trim();
		if (line === '') return;

		const metaMatch = line.match(META_RE);
		if (metaMatch) {
			try {
				const payload = JSON.parse(metaMatch[3]) as Record<string, unknown>;
				if (metaMatch[1] === 'node') nodeMeta.set(metaMatch[2], payload);
				else if (metaMatch[1] === 'edge') edgeMeta.set(metaMatch[2], payload);
				else if (metaMatch[1] === 'group') groupMeta.set(metaMatch[2], payload);
				else docMeta = payload;
			} catch {
				warnings.push(`Line ${lineNo}: @meta JSON is invalid - ignored.`);
			}
			return;
		}
		if (line.startsWith('%%')) return;

		if (line === 'architecture-beta') {
			sawHeader = true;
			return;
		}

		let match = line.match(GROUP_RE);
		if (match) {
			rawGroups.set(match[1], { title: match[3], parentMid: match[4] });
			return;
		}
		match = line.match(SERVICE_RE);
		if (match) {
			if (rawNodes.has(match[1])) {
				errors.push({ line: lineNo, message: `Duplicate service id "${match[1]}".` });
				return;
			}
			rawNodes.set(match[1], {
				mid: match[1],
				icon: match[2],
				title: match[3],
				groupMid: match[4],
				line: lineNo
			});
			return;
		}
		match = line.match(JUNCTION_RE);
		if (match) {
			warnings.push(`Line ${lineNo}: junctions aren't supported yet - "${match[1]}" ignored.`);
			return;
		}
		match = line.match(EDGE_RE);
		if (match) {
			const reversed = match[3] === '<' && match[4] !== '>';
			rawEdges.push({
				sourceMid: reversed ? match[6] : match[1],
				targetMid: reversed ? match[1] : match[6],
				sourceSide: (reversed ? match[5] : match[2]) as PortSide,
				targetSide: (reversed ? match[2] : match[5]) as PortSide,
				reversed,
				line: lineNo
			});
			return;
		}
		errors.push({ line: lineNo, message: `Unrecognized syntax: "${line.slice(0, 60)}"` });
	});

	if (!sawHeader) {
		errors.unshift({ line: 1, message: 'Missing "architecture-beta" header.' });
	}
	if (rawNodes.size === 0) {
		return { doc: null, errors, warnings };
	}

	const groups: DesignGroup[] = [];
	const groupIdByMid = new Map<string, string>();
	for (const mid of rawGroups.keys()) {
		const meta = groupMeta.get(mid);
		groupIdByMid.set(mid, (meta?.id as string) ?? mid);
	}
	for (const [mid, g] of rawGroups) {
		const parentId = g.parentMid ? groupIdByMid.get(g.parentMid) : undefined;
		if (g.parentMid && !parentId)
			warnings.push(`Group "${mid}" references unknown parent "${g.parentMid}".`);
		groups.push({ id: groupIdByMid.get(mid)!, label: g.title, parentId });
	}

	const positions = (docMeta.positions ?? {}) as Record<string, [number, number]>;
	const nodes: DesignNode[] = [];
	const realIdByMid = new Map<string, string>();
	for (const [mid, raw] of rawNodes) {
		const meta = nodeMeta.get(mid);
		const realId = (meta?.id as string) ?? mid;
		realIdByMid.set(mid, realId);
		let componentId = (meta?.componentId as string) ?? componentIdForIcon(raw.icon);
		if (!getComponentById(componentId)) {
			warnings.push(
				`Node "${mid}": unknown component "${componentId}" - using icon-based fallback.`
			);
			componentId = componentIdForIcon(raw.icon);
		}
		const pos = positions[mid];
		nodes.push({
			id: realId,
			componentId,
			label: raw.title,
			position: pos ? { x: pos[0], y: pos[1] } : { x: 0, y: 0 },
			groupId: raw.groupMid ? groupIdByMid.get(raw.groupMid) : undefined,
			config: (meta?.config as DesignNode['config']) ?? {}
		});
	}

	const edges: DesignEdge[] = [];
	const seenEdgeIds = new Set<string>();
	for (const raw of rawEdges) {
		const source = realIdByMid.get(raw.sourceMid);
		const target = realIdByMid.get(raw.targetMid);
		if (!source || !target) {
			errors.push({
				line: raw.line,
				message: `Edge references unknown service "${!source ? raw.sourceMid : raw.targetMid}".`
			});
			continue;
		}
		const metaKey = raw.reversed
			? `${raw.targetMid}->${raw.sourceMid}`
			: `${raw.sourceMid}->${raw.targetMid}`;
		const meta = edgeMeta.get(`${raw.sourceMid}->${raw.targetMid}`) ?? edgeMeta.get(metaKey);
		let id = (meta?.id as string) ?? `${source}->${target}`;
		while (seenEdgeIds.has(id)) id += '+';
		seenEdgeIds.add(id);
		edges.push({
			id,
			source,
			target,
			kind: ((meta?.kind as EdgeKind) ?? 'sync') satisfies EdgeKind,
			label: meta?.label as string | undefined,
			protocol: meta?.protocol as string | undefined,
			weight: meta?.weight as number | undefined,
			retry: meta?.retry as DesignEdge['retry'],
			breaker: meta?.breaker as DesignEdge['breaker'],
			poolSize: meta?.poolSize as number | undefined,
			ports: { sourceSide: raw.sourceSide, targetSide: raw.targetSide }
		});
	}

	const needsLayout = nodes.some(
		(n) => n.position.x === 0 && n.position.y === 0 && !positions[midOf(n.id, realIdByMid)]
	);
	if (needsLayout) autoLayout(nodes, edges);

	return {
		doc: {
			schemaVersion: 1,
			name: (docMeta.name as string) ?? 'Imported design',
			provider: ((docMeta.provider as Provider) ?? 'generic') satisfies Provider,
			slo: docMeta.slo as DesignDoc['slo'],
			nodes,
			edges,
			groups
		},
		errors,
		warnings
	};
}

function midOf(realId: string, realIdByMid: Map<string, string>): string {
	for (const [mid, real] of realIdByMid) if (real === realId) return mid;
	return realId;
}
