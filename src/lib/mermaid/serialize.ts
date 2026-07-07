import type { DesignDoc } from '$lib/types/graph';
import { mermaidIconFor } from './icons';

export function mermaidId(id: string, taken: Map<string, string>): string {
	let base = id.replace(/[^A-Za-z0-9_]/g, '_');
	if (!/^[A-Za-z_]/.test(base)) base = `n_${base}`;
	let candidate = base;
	let counter = 2;
	while (taken.has(candidate) && taken.get(candidate) !== id) candidate = `${base}_${counter++}`;
	taken.set(candidate, id);
	return candidate;
}

export function serializeDoc(doc: DesignDoc): string {
	const lines: string[] = ['architecture-beta'];
	const taken = new Map<string, string>();
	const midByReal = new Map<string, string>();

	const sortedGroups = [...doc.groups].sort((a, b) => a.id.localeCompare(b.id));
	const groupMid = new Map<string, string>();
	for (const g of sortedGroups) groupMid.set(g.id, mermaidId(g.id, taken));
	for (const g of sortedGroups) {
		const parent = g.parentId && groupMid.has(g.parentId) ? ` in ${groupMid.get(g.parentId)}` : '';
		lines.push(`  group ${groupMid.get(g.id)}(cloud)[${escapeTitle(g.label)}]${parent}`);
	}

	const sortedNodes = [...doc.nodes].sort((a, b) => a.id.localeCompare(b.id));
	for (const n of sortedNodes) {
		const mid = mermaidId(n.id, taken);
		midByReal.set(n.id, mid);
		const parent = n.groupId && groupMid.has(n.groupId) ? ` in ${groupMid.get(n.groupId)}` : '';
		lines.push(
			`  service ${mid}(${mermaidIconFor(n.componentId)})[${escapeTitle(n.label)}]${parent}`
		);
	}

	const sortedEdges = [...doc.edges].sort((a, b) => a.id.localeCompare(b.id));
	for (const e of sortedEdges) {
		const s = midByReal.get(e.source);
		const t = midByReal.get(e.target);
		if (!s || !t) continue;
		const sourceSide = e.ports?.sourceSide ?? 'R';
		const targetSide = e.ports?.targetSide ?? 'L';
		lines.push(`  ${s}:${sourceSide} --> ${targetSide}:${t}`);
	}

	for (const n of sortedNodes) {
		const meta: Record<string, unknown> = { id: n.id, componentId: n.componentId };
		if (Object.keys(n.config).length > 0) meta.config = n.config;
		lines.push(`%% @meta node ${midByReal.get(n.id)} ${JSON.stringify(meta)}`);
	}
	for (const e of sortedEdges) {
		const s = midByReal.get(e.source);
		const t = midByReal.get(e.target);
		if (!s || !t) continue;
		const meta: Record<string, unknown> = { id: e.id, kind: e.kind };
		if (e.label) meta.label = e.label;
		if (e.protocol) meta.protocol = e.protocol;
		if (e.weight !== undefined && e.weight !== 1) meta.weight = e.weight;
		if (e.retry) meta.retry = e.retry;
		if (e.breaker) meta.breaker = e.breaker;
		if (e.poolSize) meta.poolSize = e.poolSize;
		lines.push(`%% @meta edge ${s}->${t} ${JSON.stringify(meta)}`);
	}
	for (const g of sortedGroups) {
		lines.push(
			`%% @meta group ${groupMid.get(g.id)} ${JSON.stringify({ id: g.id, parentId: g.parentId })}`
		);
	}
	const positions: Record<string, [number, number]> = {};
	for (const n of sortedNodes) {
		positions[midByReal.get(n.id)!] = [Math.round(n.position.x), Math.round(n.position.y)];
	}
	lines.push(
		`%% @meta doc _ ${JSON.stringify({ schemaVersion: doc.schemaVersion, name: doc.name, provider: doc.provider, slo: doc.slo, positions })}`
	);

	return lines.join('\n') + '\n';
}

function escapeTitle(title: string): string {
	return title.replace(/[\]\n]/g, ' ').trim() || 'untitled';
}
