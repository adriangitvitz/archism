import type { DesignEdge, DesignGroup, DesignNode } from '$lib/types/graph';
import type { ParseError, ParseResult } from './parse';
import { autoLayout } from './layout';

const HEADER_RE = /^(flowchart|graph)\b\s*(TB|TD|BT|RL|LR)?\s*$/;
const SUBGRAPH_RE =
	/^subgraph\s+(?:([A-Za-z0-9_.-]+)\s*)?(?:\[\s*"?([^\]"]*)"?\s*\]|"([^"]*)")?\s*$/;
const IGNORED_RE = /^(direction\s|classDef\s|class\s|style\s|linkStyle\s|click\s)/;
const ID_RE = /^[A-Za-z0-9_.-]+/;

const LINK_RE = /^\s*(?:<)?(={2,}>?|-\.+->?|-\.+-|-{2,}>?)\s*(?:\|\s*"?([^|"]*)"?\s*\|)?\s*/;

const SHAPES: Array<{ open: string; close: string; shape: string }> = [
	{ open: '[[', close: ']]', shape: 'subroutine' },
	{ open: '[(', close: ')]', shape: 'cylinder' },
	{ open: '((', close: '))', shape: 'circle' },
	{ open: '{{', close: '}}', shape: 'hexagon' },
	{ open: '[', close: ']', shape: 'rect' },
	{ open: '(', close: ')', shape: 'rounded' },
	{ open: '{', close: '}', shape: 'diamond' },
	{ open: '>', close: ']', shape: 'asymmetric' }
];

const KEYWORDS: Array<[RegExp, string]> = [
	[/pub\/?sub|topic\b|\bsns\b|fan-?out/i, 'pub-sub'],
	[/queue|kafka|rabbit|sqs|service bus|event hub/i, 'message-queue'],
	[/bigquery|warehouse|redshift|snowflake|clickhouse|analytics db/i, 'data-warehouse'],
	[/redis|memcache|\bcache\b|memorystore/i, 'cache'],
	[/postgres|mysql|cloud sql|\brds\b|aurora|\bsql\b/i, 'sql-db'],
	[/dynamo|cosmos|mongo|firestore|bigtable|cassandra|nosql/i, 'nosql-db'],
	[/blob|bucket|\bs3\b|\bgcs\b|object storage/i, 'object-storage'],
	[/secret|vault|config|feature flag|app ?config/i, 'config-service'],
	[/scheduler|\bcron\b|scheduled/i, 'task-scheduler'],
	[/elastic|opensearch|\bsearch\b|solr/i, 'search'],
	[/api gateway|\bapim\b|\bapigee\b/i, 'api-gateway'],
	[/\blambda\b|cloud (run )?functions?|azure functions|openfaas|\bfaas\b/i, 'faas'],
	[/secrets? ?manager|key ?vault|\bvault\b/i, 'secrets-manager'],
	[/event ?bridge|event ?grid|eventarc|event ?bus/i, 'event-bus'],
	[
		/\bvpn\b|expressroute|direct connect|interconnect|transit gateway|wireguard/i,
		'private-connectivity'
	],
	[/bedrock|vertex ai|openai|sagemaker|\bllm\b|inference/i, 'ml-inference'],
	[/\bglue\b|data factory|airflow|composer|\betl\b/i, 'etl-pipeline'],
	[/spanner|cockroach|aurora dsql|yugabyte|distributed sql|citus/i, 'distributed-sql'],
	[/container apps|cloud run|app runner|knative|fargate/i, 'serverless-container'],
	[/front ?door|global accelerator|app(lication)? delivery/i, 'edge-delivery'],
	[/load balanc|\balb\b|\bnlb\b|haproxy/i, 'load-balancer'],
	[/\bcdn\b|cloudfront|akamai|fastly/i, 'cdn'],
	[/\bdns\b|route ?53/i, 'dns'],
	[/auth|cognito|entra|keycloak|okta|identity/i, 'auth-service'],
	[/monitor|grafana|prometheus|cloudwatch|app insights|logging|trazabilidad|log\b/i, 'monitoring'],
	[/websocket|socket\.io|signalr/i, 'websocket-server'],
	[/stream|flink|dataflow|kinesis/i, 'stream-processor'],
	[/notif|email|sms|push/i, 'notification-service'],
	[
		/static web ?app|amplify hosting|firebase hosting|github pages|netlify|vercel|static site/i,
		'static-hosting'
	],
	[/firewall|nsg|palo ?alto|fortigate|pfsense/i, 'firewall'],
	[/rate limit|throttl|waf/i, 'rate-limiter']
];

function inferComponent(shape: string, label: string): string {
	for (const [re, componentId] of KEYWORDS) {
		if (re.test(label)) return componentId;
	}
	if (shape === 'cylinder') return 'sql-db';
	if (shape === 'diamond' || shape === 'circle' || shape === 'hexagon' || shape === 'asymmetric')
		return 'custom';
	return 'app-server';
}

function cleanLabel(raw: string): string {
	return raw
		.replace(/<br\s*\/?>/gi, ' ')
		.replace(/<[^>]+>/g, '')
		.replace(/^"|"$/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

interface RawNode {
	id: string;
	label: string | null;
	shape: string;
	groupId?: string;
}

export function parseFlowchart(text: string): ParseResult {
	const errors: ParseError[] = [];
	const warnings: string[] = [];
	const nodes = new Map<string, RawNode>();
	const edges: DesignEdge[] = [];
	const groups: DesignGroup[] = [];
	const groupStack: string[] = [];
	const seenEdgeIds = new Set<string>();
	let sawHeader = false;
	let anonGroupSeq = 0;

	function takeNode(s: string, lineNo: number): { id: string; rest: string } | null {
		const idMatch = s.match(ID_RE);
		if (!idMatch) return null;
		const id = idMatch[0];
		let rest = s.slice(id.length);
		let shape = 'plain';
		let label: string | null = null;
		for (const candidate of SHAPES) {
			if (rest.startsWith(candidate.open)) {
				const closeIdx = rest.indexOf(candidate.close, candidate.open.length);
				if (closeIdx === -1) {
					errors.push({ line: lineNo, message: `Unclosed ${candidate.open} bracket on "${id}".` });
					return null;
				}
				shape = candidate.shape;
				label = cleanLabel(rest.slice(candidate.open.length, closeIdx));
				rest = rest.slice(closeIdx + candidate.close.length);
				break;
			}
		}
		const existing = nodes.get(id);
		if (!existing) {
			nodes.set(id, { id, label, shape, groupId: groupStack[groupStack.length - 1] });
		} else if (label !== null && existing.label === null) {
			existing.label = label;
			existing.shape = shape;
		}
		return { id, rest };
	}

	function takeNodeList(s: string, lineNo: number): { ids: string[]; rest: string } | null {
		const first = takeNode(s, lineNo);
		if (!first) return null;
		const ids = [first.id];
		let rest = first.rest;
		for (;;) {
			const amp = rest.match(/^\s*&\s*/);
			if (!amp) break;
			const next = takeNode(rest.slice(amp[0].length), lineNo);
			if (!next) break;
			ids.push(next.id);
			rest = next.rest;
		}
		return { ids, rest };
	}

	function addEdge(
		source: string,
		target: string,
		op: string,
		label: string | undefined,
		lineNo: number
	) {
		void lineNo;
		let id = `${source}->${target}`;
		while (seenEdgeIds.has(id)) id += '+';
		seenEdgeIds.add(id);
		edges.push({
			id,
			source,
			target,
			kind: op.includes('.') ? 'async' : 'sync',
			label: label ? cleanLabel(label) || undefined : undefined
		});
	}

	const lines = text.split('\n');
	lines.forEach((rawLine, i) => {
		const lineNo = i + 1;
		const line = rawLine.trim();
		if (line === '' || line.startsWith('%%')) return;

		if (!sawHeader) {
			if (HEADER_RE.test(line)) {
				sawHeader = true;
				return;
			}
			errors.push({ line: lineNo, message: 'Expected a "flowchart TD|LR" (or "graph") header.' });
			sawHeader = true;
			return;
		}

		if (IGNORED_RE.test(line)) return;

		const subgraphMatch = line.match(SUBGRAPH_RE);
		if (line.startsWith('subgraph')) {
			if (!subgraphMatch) {
				warnings.push(`Line ${lineNo}: unparsed subgraph header - treated as an unnamed group.`);
			}
			const id = subgraphMatch?.[1] ?? `group-${++anonGroupSeq}`;
			const label = cleanLabel(subgraphMatch?.[2] ?? subgraphMatch?.[3] ?? id);
			if (groupStack.length >= 2) {
				warnings.push(`Line ${lineNo}: subgraph nesting deeper than 2 - "${id}" flattened.`);
			}
			groups.push({
				id,
				label,
				parentId: groupStack.length === 1 ? groupStack[0] : undefined
			});
			groupStack.push(id);
			return;
		}
		if (line === 'end') {
			if (groupStack.length === 0) {
				errors.push({ line: lineNo, message: '"end" without a matching subgraph.' });
			} else {
				groupStack.pop();
			}
			return;
		}

		const cursor = takeNodeList(line, lineNo);
		if (!cursor) {
			errors.push({ line: lineNo, message: `Unrecognized syntax: "${line.slice(0, 60)}"` });
			return;
		}
		let currentIds = cursor.ids;
		let rest = cursor.rest;
		while (rest.trim() !== '') {
			const link = rest.match(LINK_RE);
			if (!link) {
				errors.push({
					line: lineNo,
					message: `Expected an edge operator near: "${rest.trim().slice(0, 40)}"`
				});
				return;
			}
			rest = rest.slice(link[0].length);
			const next = takeNodeList(rest, lineNo);
			if (!next) {
				errors.push({ line: lineNo, message: `Expected a node after the edge operator.` });
				return;
			}
			for (const s of currentIds) {
				for (const t of next.ids) addEdge(s, t, link[1], link[2], lineNo);
			}
			currentIds = next.ids;
			rest = next.rest;
		}
	});

	if (groupStack.length > 0) {
		warnings.push(`Unclosed subgraph(s): ${groupStack.join(', ')}.`);
	}
	if (nodes.size === 0) {
		return { doc: null, errors, warnings };
	}

	const designNodes: DesignNode[] = [...nodes.values()].map((n) => ({
		id: n.id,
		componentId: inferComponent(n.shape, n.label ?? n.id),
		label: n.label ?? n.id,
		position: { x: 0, y: 0 },
		groupId: n.groupId,
		config: {}
	}));
	autoLayout(designNodes, edges);

	return {
		doc: {
			schemaVersion: 1,
			name: 'Imported design',
			provider: 'generic',
			nodes: designNodes,
			edges,
			groups
		},
		errors,
		warnings
	};
}
