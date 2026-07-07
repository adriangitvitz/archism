import {
	frameStride,
	type IndexMaps,
	type InjectedEvent,
	type SimConfig,
	type SimEvent,
	type SimEventKind,
	type SimGraphSpec,
	type TrafficProfile
} from './types';
import { compileGraph, type CompiledGraph } from './graph';
import { evalTrafficProfile } from './traffic';
import { EventTimeline } from './events';
import { mulberry32 } from './rng';
import {
	LATENCY_SPIKE_MULTIPLIER,
	LATENCY_SPIKE_THRESHOLD,
	UTILIZATION_CRITICAL
} from './constants';

export const DT = 0.1;

const DEGRADE_AFTER_SEC = 3;
const RECOVER_AFTER_SEC = 3;
const DEGRADE_UTIL = 1.1;
const RECOVER_UTIL = 0.9;
const DEGRADED_CAPACITY = 0.75;
const DEGRADED_LATENCY = 2;
const ADMIT_RELAX = 1.2;
const ADMIT_TIGHTEN = 0.8;
const ADMIT_MAX = 1e12;
const BACKPRESSURE_AT = 0.9;

const LB_DETECTION_SEC = 10;
const SCALE_COOLDOWN_SEC = 30;
const HICCUP_MEAN_INTERVAL_SEC = 300;
const HICCUP_DURATION_SEC = 2;
const HICCUP_LATENCY_MULT = 3;
const MAX_RETRY_SLOTS = 50;

const SPLIT_COMPONENTS = new Set(['load-balancer', 'api-gateway', 'edge-delivery']);

interface GroupRuntime {
	topicIdx: number;
	memberIdxs: number[];
	dlqIdx: number;
	failureFraction: number;
	partitions: number;
	pubsubEdgeIdxs: number[];
	lag: number;
	consumeRate: number;
	dlqRate: number;
	lostRate: number;
}

interface TopicRuntime {
	nodeIdx: number;
	retentionMessages: number;
	backpressure: boolean;
	groupIdxs: number[];
}

interface RetryLine {
	edgeIdx: number;
	targetIdx: number;
	max: number;
	slots: number;
	ring: Float64Array;
}

interface BreakerRuntime {
	edgeIdx: number;
	sourceIdx: number;
	targetIdx: number;
	threshold: number;
	cooldownSec: number;
	state: 0 | 1 | 2;
	ewma: number;
	openedAt: number;
}

interface AutoscaleRuntime {
	nodeIdx: number;
	min: number;
	max: number;
	targetUtil: number;
	outDelaySec: number;
	inDelaySec: number;
	warmupSec: number;
	target: number;
	rampFrom: number;
	rampStartAt: number;
	nextActionAt: number;
}

export class SimEngine {
	readonly spec: SimGraphSpec;
	readonly graph: CompiledGraph;
	readonly indexMaps: IndexMaps;
	readonly stride: number;

	simTime = 0;
	private tickCount = 0;
	private profile: TrafficProfile;
	private trafficMult = 1;
	private readonly jitter: number;
	private readonly rng: () => number;

	private readonly n: number;
	private readonly e: number;
	private readonly idToIdx = new Map<string, number>();
	private readonly orderIdxs: number[];
	private readonly routing: ('fanout' | 'split' | 'topic')[];
	private readonly perReplicaCap: Float64Array;
	private readonly baseLatency: Float64Array;
	private readonly queueBound: Float64Array;
	private readonly timeoutSec: Float64Array;
	private readonly entrySet: Set<number>;

	private readonly queue: Float64Array;
	private readonly admitLimit: Float64Array;
	private readonly capacityMult: Float64Array;
	private readonly latencyMult: Float64Array;
	private readonly dead: Uint8Array;
	private readonly deadSince: Float64Array;
	private readonly ejected: Uint8Array;
	private readonly degraded: Uint8Array;
	private readonly overloadSec: Float64Array;
	private readonly calmSec: Float64Array;
	private readonly inject: Float64Array;
	private readonly injectNext: Float64Array;
	private readonly retryIn: Float64Array;
	private readonly retryInNext: Float64Array;
	private readonly prevInRate: Float64Array;
	private readonly curReplicas: Float64Array;
	private readonly hiccupUntil: Float64Array;
	private readonly latencyNoise: Float64Array;
	private readonly capacityNoise: Float64Array;

	private readonly cacheTargetHit: Float64Array;
	private readonly cacheWarmupSec: Float64Array;
	private readonly curHitRatio: Float64Array;

	private readonly inRate: Float64Array;
	private readonly served: Float64Array;
	private readonly errorRate: Float64Array;
	private readonly droppedRate: Float64Array;
	private readonly timeoutRate: Float64Array;
	private readonly util: Float64Array;
	private readonly latencyMs: Float64Array;

	private readonly edgeSourceIdx: Int32Array;
	private readonly edgeTargetIdx: Int32Array;
	private readonly edgeKind: Uint8Array;
	private readonly edgeWeight: Float64Array;
	private readonly edgeFlow: Float64Array;
	private readonly edgeRetryFlow: Float64Array;
	readonly retryGate: Float64Array;
	private readonly edgeGate: Float64Array;
	private readonly edgeDown: Uint8Array;
	private readonly errorInject: Float64Array;
	private readonly edgeIdToIdx = new Map<string, number>();
	private readonly edgePool: Float64Array;
	private readonly edgeExtraLatency: Float64Array;
	private readonly poolExhausted: Uint8Array;
	private readonly entryRps: Float64Array;
	private readonly breakers: BreakerRuntime[] = [];
	private readonly outEdgeIdxs: number[][];
	private readonly inEdgeIdxs: number[][];
	private readonly syncAdjacency: number[][];
	private readonly syncExtra: number[][];
	private readonly retryLines: RetryLine[] = [];

	private readonly topics: TopicRuntime[] = [];
	private readonly groups: GroupRuntime[] = [];
	private readonly autoscalers: AutoscaleRuntime[] = [];

	private readonly timeline = new EventTimeline();
	readonly warnings: string[];
	private pendingEvents: SimEvent[] = [];

	private readonly prevHealthBits: Uint8Array;
	private readonly prevAdmitEngaged: Uint8Array;
	private readonly prevQueueFull: Uint8Array;

	constructor(spec: SimGraphSpec, config: SimConfig) {
		this.spec = spec;
		this.profile = config.profile;
		this.jitter = Math.max(0, config.jitter ?? 0);
		this.rng = mulberry32(config.seed);
		this.graph = compileGraph(spec.nodes, spec.edges);
		this.warnings = [...this.graph.warnings];

		this.n = spec.nodes.length;
		this.e = spec.edges.length;
		spec.nodes.forEach((node, i) => this.idToIdx.set(node.id, i));
		this.orderIdxs = this.graph.order.map((id) => this.idToIdx.get(id)!);

		const dlqTargets = new Set(
			spec.topics.flatMap((t) => t.groups.map((g) => g.dlqNodeId)).filter((id) => id !== undefined)
		);
		this.entrySet = new Set(
			this.graph.entryIds.filter((id) => !dlqTargets.has(id)).map((id) => this.idToIdx.get(id)!)
		);

		this.routing = spec.nodes.map((node) =>
			node.routing === 'topic'
				? 'topic'
				: SPLIT_COMPONENTS.has(node.componentId)
					? 'split'
					: node.routing
		);
		this.perReplicaCap = new Float64Array(this.n);
		this.baseLatency = new Float64Array(this.n);
		this.queueBound = new Float64Array(this.n);
		this.timeoutSec = new Float64Array(this.n);
		this.entryRps = new Float64Array(this.n).fill(-1);
		this.curReplicas = new Float64Array(this.n);
		this.cacheTargetHit = new Float64Array(this.n);
		this.cacheWarmupSec = new Float64Array(this.n);
		this.curHitRatio = new Float64Array(this.n);
		spec.nodes.forEach((node, i) => {
			const maxQPS = Number.isFinite(node.maxQPS) && node.maxQPS > 0 ? node.maxQPS : 0;
			const replicas =
				Number.isFinite(node.replicas) && node.replicas >= 1 ? Math.floor(node.replicas) : 1;
			this.perReplicaCap[i] = maxQPS;
			this.curReplicas[i] = replicas;
			this.baseLatency[i] = node.baseLatencyMs;
			this.queueBound[i] =
				Number.isFinite(node.queueBound) && node.queueBound >= 0 ? node.queueBound : 0;
			this.timeoutSec[i] =
				Number.isFinite(node.timeoutMs) && node.timeoutMs > 0 ? node.timeoutMs / 1000 : 0;
			if (node.entryRps !== undefined && node.entryRps >= 0) this.entryRps[i] = node.entryRps;
			if (node.cache) {
				this.cacheTargetHit[i] = Math.min(1, Math.max(0, node.cache.hitRatio));
				this.cacheWarmupSec[i] = Math.max(0, node.cache.warmupSec);
				this.curHitRatio[i] = this.cacheTargetHit[i];
			}
			if (node.autoscale) {
				const a = node.autoscale;
				const min = Math.max(1, Math.floor(a.min));
				const max = Math.max(min, Math.floor(a.max));
				this.curReplicas[i] = Math.min(Math.max(replicas, min), max);
				this.autoscalers.push({
					nodeIdx: i,
					min,
					max,
					targetUtil: Math.min(1, Math.max(0.1, a.targetUtil)),
					outDelaySec: Math.max(0, a.scaleOutDelaySec),
					inDelaySec: Math.max(0, a.scaleInDelaySec),
					warmupSec: Math.max(0, a.warmupSec),
					target: this.curReplicas[i],
					rampFrom: this.curReplicas[i],
					rampStartAt: 0,
					nextActionAt: 0
				});
			}
		});

		this.queue = new Float64Array(this.n);
		this.admitLimit = new Float64Array(this.n).fill(ADMIT_MAX);
		this.capacityMult = new Float64Array(this.n).fill(1);
		this.latencyMult = new Float64Array(this.n).fill(1);
		this.dead = new Uint8Array(this.n);
		this.deadSince = new Float64Array(this.n);
		this.ejected = new Uint8Array(this.n);
		this.degraded = new Uint8Array(this.n);
		this.overloadSec = new Float64Array(this.n);
		this.calmSec = new Float64Array(this.n);
		this.inject = new Float64Array(this.n);
		this.injectNext = new Float64Array(this.n);
		this.retryIn = new Float64Array(this.n);
		this.retryInNext = new Float64Array(this.n);
		this.prevInRate = new Float64Array(this.n);
		this.hiccupUntil = new Float64Array(this.n);
		this.latencyNoise = new Float64Array(this.n).fill(1);
		this.capacityNoise = new Float64Array(this.n).fill(1);
		this.inRate = new Float64Array(this.n);
		this.served = new Float64Array(this.n);
		this.errorRate = new Float64Array(this.n);
		this.droppedRate = new Float64Array(this.n);
		this.timeoutRate = new Float64Array(this.n);
		this.util = new Float64Array(this.n);
		this.latencyMs = new Float64Array(this.n);
		this.prevHealthBits = new Uint8Array(this.n);
		this.prevAdmitEngaged = new Uint8Array(this.n);
		this.prevQueueFull = new Uint8Array(this.n);

		this.edgeSourceIdx = new Int32Array(this.e);
		this.edgeTargetIdx = new Int32Array(this.e);
		this.edgeKind = new Uint8Array(this.e);
		this.edgeWeight = new Float64Array(this.e).fill(1);
		this.edgeFlow = new Float64Array(this.e);
		this.edgeRetryFlow = new Float64Array(this.e);
		this.retryGate = new Float64Array(this.e).fill(1);
		this.edgeGate = new Float64Array(this.e).fill(1);
		this.edgeDown = new Uint8Array(this.e);
		this.edgePool = new Float64Array(this.e);
		this.edgeExtraLatency = new Float64Array(this.e);
		this.poolExhausted = new Uint8Array(this.e);
		this.errorInject = new Float64Array(this.n);
		this.outEdgeIdxs = Array.from({ length: this.n }, () => []);
		this.inEdgeIdxs = Array.from({ length: this.n }, () => []);
		this.syncAdjacency = Array.from({ length: this.n }, () => []);
		this.syncExtra = Array.from({ length: this.n }, () => []);
		const seenPairs = new Set<string>();
		spec.edges.forEach((edge, k) => {
			const s = this.idToIdx.get(edge.source);
			const t = this.idToIdx.get(edge.target);
			this.edgeKind[k] = edge.kind === 'pubsub' ? 2 : edge.kind === 'async' ? 1 : 0;
			this.edgeWeight[k] =
				Number.isFinite(edge.weight) && edge.weight >= 0 ? Math.min(1, edge.weight) : 1;
			this.edgePool[k] = edge.poolSize && edge.poolSize > 0 ? edge.poolSize : 0;
			this.edgeExtraLatency[k] = edge.extraLatencyMs ?? 0;
			if (s === undefined || t === undefined || s === t) {
				this.edgeSourceIdx[k] = -1;
				this.edgeTargetIdx[k] = -1;
				return;
			}
			const pair = `${s}->${t}`;
			if (seenPairs.has(pair)) {
				this.edgeSourceIdx[k] = -1;
				this.edgeTargetIdx[k] = -1;
				return;
			}
			seenPairs.add(pair);
			this.edgeSourceIdx[k] = s;
			this.edgeTargetIdx[k] = t;
			if (edge.kind !== 'pubsub') {
				this.outEdgeIdxs[s].push(k);
				this.inEdgeIdxs[t].push(k);
			}
			if (edge.kind === 'sync' && this.edgeWeight[k] > 0) {
				this.syncAdjacency[s].push(t);
				this.syncExtra[s].push(edge.extraLatencyMs ?? 0);
			}
			this.edgeIdToIdx.set(edge.id, k);
			if (edge.kind === 'sync' && edge.breaker) {
				this.breakers.push({
					edgeIdx: k,
					sourceIdx: s,
					targetIdx: t,
					threshold: Math.min(1, Math.max(0.01, edge.breaker.errorThreshold)),
					cooldownSec: Math.max(1, edge.breaker.cooldownSec),
					state: 0,
					ewma: 0,
					openedAt: 0
				});
			}
			if (edge.kind === 'sync' && edge.retry && edge.retry.max > 0) {
				const slots = Math.min(
					MAX_RETRY_SLOTS,
					Math.max(1, Math.round(edge.retry.backoffMs / (DT * 1000)))
				);
				this.retryLines.push({
					edgeIdx: k,
					targetIdx: t,
					max: Math.floor(edge.retry.max),
					slots,
					ring: new Float64Array(slots)
				});
			}
		});

		for (const topic of spec.topics) {
			const nodeIdx = this.idToIdx.get(topic.nodeId);
			if (nodeIdx === undefined) continue;
			const groupIdxs: number[] = [];
			for (const group of topic.groups) {
				const memberIdxs = group.memberNodeIds
					.map((id) => this.idToIdx.get(id))
					.filter((i): i is number => i !== undefined);
				if (memberIdxs.length === 0) continue;
				const pubsubEdgeIdxs = memberIdxs.map((memberIdx) => {
					for (let k = 0; k < this.e; k++) {
						if (
							this.edgeKind[k] === 2 &&
							this.edgeSourceIdx[k] === nodeIdx &&
							this.edgeTargetIdx[k] === memberIdx
						)
							return k;
					}
					return -1;
				});
				groupIdxs.push(this.groups.length);
				this.groups.push({
					topicIdx: nodeIdx,
					memberIdxs,
					dlqIdx: group.dlqNodeId !== undefined ? (this.idToIdx.get(group.dlqNodeId) ?? -1) : -1,
					failureFraction: Math.min(1, Math.max(0, group.failureFraction)),

					partitions: topic.partitionsCapParallelism
						? Math.max(1, topic.partitions)
						: Number.POSITIVE_INFINITY,
					pubsubEdgeIdxs,
					lag: 0,
					consumeRate: 0,
					dlqRate: 0,
					lostRate: 0
				});
			}
			this.topics.push({
				nodeIdx,
				retentionMessages: Math.max(0, topic.retentionMessages),
				backpressure: topic.backpressure,
				groupIdxs
			});
		}

		this.indexMaps = {
			nodeIndex: Object.fromEntries(spec.nodes.map((node, i) => [node.id, i])),
			edgeIndex: Object.fromEntries(spec.edges.map((edge, k) => [edge.id, k])),
			groupIndex: Object.fromEntries(
				spec.topics.flatMap((topic) =>
					topic.groups
						.filter((g) => g.memberNodeIds.some((id) => this.idToIdx.has(id)))
						.map((g) => [`${topic.nodeId}/${g.id}`, 0])
				)
			)
		};
		let gi = 0;
		for (const key of Object.keys(this.indexMaps.groupIndex)) this.indexMaps.groupIndex[key] = gi++;

		this.stride = frameStride(this.n, this.e, this.groups.length);
	}

	get groupCount(): number {
		return this.groups.length;
	}

	setProfile(profile: TrafficProfile): void {
		this.profile = profile;
	}

	inject_(event: InjectedEvent): void {
		this.timeline.schedule(event, event.atSimTime ?? this.simTime);
	}

	drainEvents(): SimEvent[] {
		const out = this.pendingEvents;
		this.pendingEvents = [];
		return out;
	}

	private emit(kind: SimEventKind, nodeIdx: number, detail?: string): void {
		this.pendingEvents.push({
			simTime: this.simTime,
			kind,
			nodeId: this.spec.nodes[nodeIdx]?.id ?? '?',
			detail
		});
	}

	private applyEvent(event: InjectedEvent): void {
		const idx = 'nodeId' in event ? this.idToIdx.get(event.nodeId) : undefined;
		switch (event.type) {
			case 'kill-node':
				if (idx === undefined || this.dead[idx]) return;
				this.dead[idx] = 1;
				this.deadSince[idx] = this.simTime;
				this.ejected[idx] = 0;
				this.emit('died', idx);
				this.prevHealthBits[idx] = 2;
				if (event.recoverAfterSec) {
					this.timeline.schedule(
						{ type: 'revive-node', nodeId: event.nodeId },
						this.simTime + event.recoverAfterSec
					);
				}
				break;
			case 'revive-node':
				if (idx === undefined || !this.dead[idx]) return;
				this.dead[idx] = 0;
				this.degraded[idx] = 0;
				this.overloadSec[idx] = 0;
				this.ejected[idx] = 0;

				if (this.cacheTargetHit[idx] > 0) this.curHitRatio[idx] = 0;
				this.emit('revived', idx);
				this.prevHealthBits[idx] = 0;
				break;
			case 'traffic-mult':
				this.trafficMult *= event.factor;
				if (event.durationSec) {
					this.timeline.schedule(
						{ type: 'traffic-mult', factor: 1 / event.factor },
						this.simTime + event.durationSec
					);
				}
				break;
			case 'latency-mult':
				if (idx === undefined) return;
				this.latencyMult[idx] *= event.factor;
				if (event.durationSec) {
					this.timeline.schedule(
						{ type: 'latency-mult', nodeId: event.nodeId, factor: 1 / event.factor },
						this.simTime + event.durationSec
					);
				}
				break;
			case 'capacity-mult':
				if (idx === undefined) return;
				this.capacityMult[idx] *= event.factor;
				if (event.durationSec) {
					this.timeline.schedule(
						{ type: 'capacity-mult', nodeId: event.nodeId, factor: 1 / event.factor },
						this.simTime + event.durationSec
					);
				}
				break;
			case 'publish-burst': {
				const topicIdx = this.idToIdx.get(event.topicId);
				if (topicIdx === undefined) return;
				this.injectNext[topicIdx] += event.messages / DT;
				break;
			}
			case 'error-inject':
				if (idx === undefined) return;
				this.errorInject[idx] = Math.min(1, Math.max(0, event.fraction));
				if (event.durationSec && event.fraction > 0) {
					this.timeline.schedule(
						{ type: 'error-inject', nodeId: event.nodeId, fraction: 0 },
						this.simTime + event.durationSec
					);
				}
				break;
			case 'partition-edge': {
				const k = this.edgeIdToIdx.get(event.edgeId);
				if (k === undefined || this.edgeDown[k]) return;
				this.edgeDown[k] = 1;
				const t = this.edgeTargetIdx[k];
				if (t >= 0) this.emit('partitioned', t, `link ${event.edgeId} down`);
				if (event.durationSec) {
					this.timeline.schedule(
						{ type: 'restore-edge', edgeId: event.edgeId },
						this.simTime + event.durationSec
					);
				}
				break;
			}
			case 'restore-edge': {
				const k = this.edgeIdToIdx.get(event.edgeId);
				if (k === undefined || !this.edgeDown[k]) return;
				this.edgeDown[k] = 0;
				const t = this.edgeTargetIdx[k];
				if (t >= 0) this.emit('restored', t, `link ${event.edgeId} up`);
				break;
			}
			case 'rolling-restart': {
				if (idx === undefined) return;
				const replicas = Math.max(1, Math.round(this.curReplicas[idx]));
				const per = Math.max(1, event.perReplicaSec ?? 10);
				const factor = replicas > 1 ? (replicas - 1) / replicas : 0.05;
				this.emit('deploy', idx, `rolling restart: ${replicas} replicas × ${per}s`);
				for (let r = 0; r < replicas; r++) {
					this.timeline.schedule(
						{
							type: 'capacity-mult',
							nodeId: event.nodeId,
							factor,
							durationSec: per
						},
						this.simTime + r * per
					);
				}
				break;
			}
		}
	}

	private effectiveCap(i: number): number {
		if (this.dead[i]) return 0;
		return (
			this.perReplicaCap[i] *
			this.curReplicas[i] *
			this.capacityMult[i] *
			this.capacityNoise[i] *
			(this.degraded[i] ? DEGRADED_CAPACITY : 1)
		);
	}

	private gaussian(): number {
		let u = 0;
		while (u === 0) u = this.rng();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rng());
	}

	private stepNoise(): void {
		if (this.jitter <= 0) return;
		const sigma = this.jitter;
		const halfVar = (sigma * sigma) / 2;
		const hiccupP = DT / HICCUP_MEAN_INTERVAL_SEC;
		for (let i = 0; i < this.n; i++) {
			this.latencyNoise[i] = Math.exp(sigma * this.gaussian() - halfVar);
			this.capacityNoise[i] = Math.exp(sigma * 0.6 * this.gaussian() - halfVar * 0.36);
			if (this.rng() < hiccupP && this.hiccupUntil[i] < this.simTime && !this.dead[i]) {
				this.hiccupUntil[i] = this.simTime + HICCUP_DURATION_SEC;
				this.emit('hiccup', i, `latency ×${HICCUP_LATENCY_MULT} for ${HICCUP_DURATION_SEC}s`);
			}
		}
	}

	private stepAutoscalers(): void {
		for (const as of this.autoscalers) {
			const i = as.nodeIdx;
			if (this.dead[i]) continue;

			const demand = this.prevInRate[i];
			const perCap = this.perReplicaCap[i] * this.capacityMult[i];
			if (perCap <= 0) continue;
			const desired = Math.min(
				as.max,
				Math.max(as.min, Math.ceil(demand / (perCap * as.targetUtil)))
			);
			if (desired > as.target) {
				const pendingBatch = this.simTime < as.rampStartAt && as.target > Math.round(as.rampFrom);
				as.rampFrom = this.curReplicas[i];
				if (!pendingBatch) {
					as.rampStartAt = this.simTime + as.outDelaySec;
				}
				as.target = desired;
				as.nextActionAt = as.rampStartAt + as.warmupSec + SCALE_COOLDOWN_SEC;
				this.emit(
					'scaled-out',
					i,
					`${Math.round(as.rampFrom)}→${as.target}${as.outDelaySec > 0 ? ` (arrives in ${as.outDelaySec}s)` : ''}`
				);
			} else if (desired < as.target && this.simTime >= as.nextActionAt) {
				as.target = Math.max(desired, as.min);
				as.rampFrom = this.curReplicas[i];
				as.rampStartAt = this.simTime + as.inDelaySec;
				as.nextActionAt = as.rampStartAt + SCALE_COOLDOWN_SEC;
				this.emit('scaled-in', i, `${Math.round(as.rampFrom)}→${as.target}`);
			}
			if (this.simTime >= as.rampStartAt && this.curReplicas[i] !== as.target) {
				if (as.target < as.rampFrom || as.warmupSec <= 0) {
					this.curReplicas[i] = as.target;
				} else {
					const progress = Math.min(1, (this.simTime - as.rampStartAt) / as.warmupSec);
					this.curReplicas[i] = as.rampFrom + (as.target - as.rampFrom) * progress;
				}
			}
		}
	}

	private stepCaches(): void {
		for (let i = 0; i < this.n; i++) {
			const target = this.cacheTargetHit[i];
			if (target <= 0 || this.curHitRatio[i] >= target) continue;
			const warmup = this.cacheWarmupSec[i];
			this.curHitRatio[i] =
				warmup <= 0 ? target : Math.min(target, this.curHitRatio[i] + (target / warmup) * DT);
		}
	}

	tick(): void {
		for (const event of this.timeline.popDue(this.simTime)) this.applyEvent(event);

		this.stepAutoscalers();
		this.stepCaches();

		this.stepNoise();
		const globalOffered = Math.max(
			0,
			evalTrafficProfile(this.profile, this.simTime) * this.trafficMult
		);
		let splitEntries = 0;
		for (const i of this.entrySet) if (this.entryRps[i] < 0) splitEntries++;
		const perEntry = splitEntries > 0 ? globalOffered / splitEntries : 0;

		this.prevInRate.set(this.inRate);
		this.inject.set(this.injectNext);
		this.injectNext.fill(0);
		this.retryIn.set(this.retryInNext);
		this.retryInNext.fill(0);
		this.edgeFlow.fill(0);

		for (const i of this.orderIdxs) {
			let inRate = this.inject[i];
			if (this.entrySet.has(i)) {
				inRate += this.entryRps[i] >= 0 ? this.entryRps[i] * this.trafficMult : perEntry;
			}
			for (const k of this.inEdgeIdxs[i]) inRate += this.edgeFlow[k];
			this.inRate[i] = inRate;

			const cap = this.effectiveCap(i);
			let accepted = this.dead[i] ? 0 : Math.min(inRate, this.admitLimit[i]);
			let errors = inRate - accepted;
			if (this.errorInject[i] > 0 && accepted > 0) {
				const failing = accepted * this.errorInject[i];
				accepted -= failing;
				errors += failing;
			}

			this.queue[i] += accepted * DT;
			const servable = Math.min(this.queue[i] / DT, cap);
			this.queue[i] -= servable * DT;
			if (this.queue[i] < 1e-9) this.queue[i] = 0;
			const bound = this.queueBound[i];
			let dropped = 0;
			if (bound > 0 && this.queue[i] > bound) {
				dropped = (this.queue[i] - bound) / DT;
				this.queue[i] = bound;
			} else if (bound === 0 && this.queue[i] > 0 && cap > 0) {
				dropped = this.queue[i] / DT;
				this.queue[i] = 0;
			}

			let timedOut = 0;
			const tSec = this.timeoutSec[i];
			if (tSec > 0) {
				const maxTolerable = cap * tSec;
				if (this.queue[i] > maxTolerable) {
					timedOut = (this.queue[i] - maxTolerable) / DT;
					this.queue[i] = maxTolerable;
				}
			}

			const util = cap > 0 ? inRate / cap : inRate > 0 ? 2 : 0;
			this.util[i] = Math.min(util, 2);
			if (this.dead[i]) errors = inRate;

			const rawCap = this.dead[i]
				? 0
				: this.perReplicaCap[i] * this.curReplicas[i] * this.capacityMult[i];
			const rawUtil = rawCap > 0 ? inRate / rawCap : inRate > 0 ? 2 : 0;
			if (rawUtil > DEGRADE_UTIL && !this.dead[i]) {
				this.overloadSec[i] += DT;
				this.calmSec[i] = 0;
				if (this.overloadSec[i] >= DEGRADE_AFTER_SEC) this.degraded[i] = 1;
			} else if (rawUtil < RECOVER_UTIL) {
				this.calmSec[i] += DT;
				this.overloadSec[i] = 0;
				if (this.degraded[i] && this.calmSec[i] >= RECOVER_AFTER_SEC) this.degraded[i] = 0;
			} else {
				this.overloadSec[i] = 0;
			}

			const queueWaitMs = cap > 0 ? (this.queue[i] / cap) * 1000 : 0;
			const spiked =
				util > LATENCY_SPIKE_THRESHOLD
					? this.baseLatency[i] *
						(1 + Math.max(0, util - LATENCY_SPIKE_THRESHOLD) * LATENCY_SPIKE_MULTIPLIER)
					: this.baseLatency[i];
			const hiccup = this.hiccupUntil[i] > this.simTime ? HICCUP_LATENCY_MULT : 1;
			this.latencyMs[i] =
				spiked *
					this.latencyMult[i] *
					this.latencyNoise[i] *
					hiccup *
					(this.degraded[i] ? DEGRADED_LATENCY : 1) +
				queueWaitMs;

			this.served[i] = servable;
			this.errorRate[i] = errors;
			this.droppedRate[i] = dropped;
			this.timeoutRate[i] = timedOut;

			if (this.routing[i] === 'topic') continue;
			const outs = this.outEdgeIdxs[i];
			if (outs.length === 0) continue;

			const missFactor = this.cacheTargetHit[i] > 0 ? 1 - this.curHitRatio[i] : 1;
			if (this.routing[i] === 'split') {
				const eligible = outs.filter((k) => {
					const t = this.edgeTargetIdx[k];
					if (t < 0) return false;
					if (this.edgeDown[k] || this.edgeGate[k] === 0) return false;
					if (!this.dead[t]) return true;
					const undetected = this.simTime - this.deadSince[t] < LB_DETECTION_SEC;
					if (!undetected && !this.ejected[t]) {
						this.ejected[t] = 1;
						this.emit('lb-ejected', t, 'health checks removed dead backend');
					}
					return undetected;
				});
				const targets =
					eligible.length > 0 ? eligible : outs.filter((k) => this.edgeTargetIdx[k] >= 0);
				let weightSum = 0;
				for (const k of targets) weightSum += this.edgeWeight[k];
				if (weightSum <= 0) continue;
				for (const k of targets) {
					this.edgeFlow[k] = ((servable * this.edgeWeight[k]) / weightSum) * missFactor;
				}
			} else {
				for (const k of outs) {
					const want = servable * this.edgeWeight[k] * missFactor;
					if (want <= 0) continue;
					if (this.edgeDown[k]) {
						this.errorRate[i] += want;
						continue;
					}
					const gate = this.edgeGate[k];
					if (gate < 1) {
						this.errorRate[i] += want * (1 - gate);
					}
					let flow = want * gate;
					const pool = this.edgePool[k];
					if (pool > 0 && flow > 0) {
						const t = this.edgeTargetIdx[k];
						const targetLatencySec = Math.max(0.001, this.latencyMs[t] / 1000 || 0.001);
						const maxRate = pool / targetLatencySec;
						if (flow > maxRate) {
							this.errorRate[i] += flow - maxRate;
							flow = maxRate;
							if (!this.poolExhausted[k]) {
								this.poolExhausted[k] = 1;
								this.emit('pool-exhausted', i, `edge pool ${pool} exhausted (callee slow)`);
							}
						} else if (this.poolExhausted[k] && flow < maxRate * 0.8) {
							this.poolExhausted[k] = 0;
						}
					}
					this.edgeFlow[k] = flow;
				}
			}
		}

		for (const topic of this.topics) {
			const producedRate = this.served[topic.nodeIdx];
			for (const gi of topic.groupIdxs) {
				const group = this.groups[gi];
				const alive = group.memberIdxs.filter((m) => !this.dead[m]);
				let groupCapacity = 0;
				if (alive.length > 0) {
					const perMemberAvg = alive.reduce((s, m) => s + this.effectiveCap(m), 0) / alive.length;
					groupCapacity = Math.min(alive.length, group.partitions) * perMemberAvg;
				}
				const desired = group.lag / DT + producedRate;
				const consumeRate = Math.min(desired, groupCapacity);
				group.lag += (producedRate - consumeRate) * DT;
				group.lostRate = 0;
				if (
					topic.retentionMessages > 0 &&
					group.lag > topic.retentionMessages &&
					!topic.backpressure
				) {
					group.lostRate = (group.lag - topic.retentionMessages) / DT;
					group.lag = topic.retentionMessages;
				}
				group.consumeRate = consumeRate;
				group.dlqRate = consumeRate * group.failureFraction;
				if (group.dlqIdx >= 0 && group.dlqRate > 0) this.injectNext[group.dlqIdx] += group.dlqRate;
				if (alive.length > 0) {
					const perMember = consumeRate / alive.length;
					alive.forEach((m) => {
						this.injectNext[m] += perMember;
					});
					group.memberIdxs.forEach((m, j) => {
						const k = group.pubsubEdgeIdxs[j];
						if (k >= 0) this.edgeFlow[k] = this.dead[m] ? 0 : perMember;
					});
				}
			}
		}

		this.edgeRetryFlow.fill(0);
		for (const line of this.retryLines) {
			const t = line.targetIdx;
			const slot = this.tickCount % line.slots;
			const matured = line.ring[slot];
			line.ring[slot] = 0;
			if (matured > 0) {
				this.injectNext[t] += matured;
				this.retryInNext[t] += matured;
				this.edgeRetryFlow[line.edgeIdx] = matured;
			}
			const inT = this.inRate[t];
			if (inT <= 0) continue;
			const failFraction = Math.min(
				0.95,
				(this.errorRate[t] + this.timeoutRate[t] + this.droppedRate[t]) / inT
			);
			if (failFraction <= 0) continue;
			const firstAttempt = this.edgeFlow[line.edgeIdx];
			if (firstAttempt <= 0) continue;
			const expectedRetries =
				(failFraction * (1 - Math.pow(failFraction, line.max))) / (1 - failFraction);
			const pushed = firstAttempt * expectedRetries * this.retryGate[line.edgeIdx];
			if (pushed > 0) line.ring[slot] += pushed;
		}

		for (const b of this.breakers) {
			const t = b.targetIdx;
			const inT = this.inRate[t];
			const failFraction =
				inT > 0 ? (this.errorRate[t] + this.timeoutRate[t] + this.droppedRate[t]) / inT : 0;
			if (this.edgeFlow[b.edgeIdx] > 0 || b.state === 2) {
				b.ewma = 0.85 * b.ewma + 0.15 * Math.min(1, failFraction);
			}
			let gate: number;
			if (b.state === 0) {
				if (b.ewma > b.threshold) {
					b.state = 1;
					b.openedAt = this.simTime;
					gate = 0;
					this.emit('breaker-open', t, `ewma failure ${(b.ewma * 100).toFixed(0)}%`);
				} else {
					gate = 1;
				}
			} else if (b.state === 1) {
				gate = 0;
				if (this.simTime - b.openedAt >= b.cooldownSec) {
					b.state = 2;
					gate = 0.05;
					this.emit('breaker-half-open', t);
				}
			} else {
				if (b.ewma > b.threshold) {
					b.state = 1;
					b.openedAt = this.simTime;
					gate = 0;
					this.emit('breaker-open', t, 'probe failed');
				} else if (b.ewma < b.threshold * 0.5) {
					b.state = 0;
					gate = 1;
					this.emit('breaker-closed', t);
				} else {
					gate = 0.05;
				}
			}
			this.edgeGate[b.edgeIdx] = gate;
			this.retryGate[b.edgeIdx] = gate;
		}

		const desiredLimit = new Float64Array(this.n).fill(ADMIT_MAX);
		for (let oi = this.orderIdxs.length - 1; oi >= 0; oi--) {
			const i = this.orderIdxs[oi];
			const bound = this.queueBound[i];
			const congested = bound > 0 && this.queue[i] >= bound * BACKPRESSURE_AT;
			if (congested) {
				for (const k of this.inEdgeIdxs[i]) {
					const s = this.edgeSourceIdx[k];
					if (s < 0) continue;
					desiredLimit[s] = Math.min(desiredLimit[s], Math.max(this.served[i], 1));
				}
			}
		}
		for (const topic of this.topics) {
			if (!topic.backpressure) continue;
			for (const gi of topic.groupIdxs) {
				const group = this.groups[gi];
				if (topic.retentionMessages > 0 && group.lag >= topic.retentionMessages * BACKPRESSURE_AT) {
					for (const k of this.inEdgeIdxs[topic.nodeIdx]) {
						const s = this.edgeSourceIdx[k];
						if (s < 0) continue;
						desiredLimit[s] = Math.min(desiredLimit[s], Math.max(group.consumeRate, 1));
					}
					group.lag = Math.min(group.lag, topic.retentionMessages);
				}
			}
		}
		for (let i = 0; i < this.n; i++) {
			const current = this.admitLimit[i];
			const desired = desiredLimit[i];
			if (desired < current) {
				this.admitLimit[i] = Math.max(desired, current * ADMIT_TIGHTEN, 1);
			} else if (current < ADMIT_MAX) {
				const relaxed = Math.max(current * ADMIT_RELAX, this.perReplicaCap[i] * 0.01 + 1);
				this.admitLimit[i] = Math.min(
					relaxed >= ADMIT_MAX / ADMIT_RELAX ? ADMIT_MAX : relaxed,
					ADMIT_MAX
				);
			}
		}

		for (let i = 0; i < this.n; i++) {
			const health = this.dead[i] ? 2 : this.degraded[i] ? 1 : 0;
			const prev = this.prevHealthBits[i];
			if (health !== prev) {
				if (health === 1 && prev !== 1) this.emit('degraded', i);
				else if (health === 0 && prev === 1) this.emit('recovered', i);
				this.prevHealthBits[i] = health;
			}
			const engaged = this.admitLimit[i] < ADMIT_MAX / 2 ? 1 : 0;
			if (engaged !== this.prevAdmitEngaged[i]) {
				this.emit(engaged ? 'backpressure-on' : 'backpressure-off', i);
				this.prevAdmitEngaged[i] = engaged;
			}
			const bound = this.queueBound[i];
			const full = bound > 0 && this.queue[i] >= bound * 0.999 ? 1 : 0;
			if (full && !this.prevQueueFull[i]) this.emit('queue-full', i);
			this.prevQueueFull[i] = full;
		}

		this.tickCount++;
		this.simTime = Math.round((this.simTime + DT) * 1e9) / 1e9;
	}

	private pathLatencyMs(): number {
		if (this.entrySet.size === 0) return 0;
		const dist = new Float64Array(this.n).fill(-1);
		for (const i of this.entrySet) {
			if (this.syncAdjacency[i].length === 0 && this.outEdgeIdxs[i].length > 0) continue;
			dist[i] = this.latencyMs[i];
		}
		let max = 0;
		for (const i of this.orderIdxs) {
			if (dist[i] < 0) continue;
			if (dist[i] > max) max = dist[i];
			for (let j = 0; j < this.syncAdjacency[i].length; j++) {
				const t = this.syncAdjacency[i][j];
				const candidate = dist[i] + this.latencyMs[t] + this.syncExtra[i][j];
				if (candidate > dist[t]) dist[t] = candidate;
			}
		}
		return max;
	}

	writeFrame(out: Float32Array, base: number): number {
		let o = base;
		out[o++] = this.simTime;
		for (let i = 0; i < this.n; i++) {
			out[o++] = this.inRate[i];
			out[o++] = this.served[i];
			out[o++] = this.errorRate[i];
			out[o++] = this.droppedRate[i];
			out[o++] = this.timeoutRate[i];
			out[o++] = this.retryIn[i];
			out[o++] = this.util[i];
			out[o++] = this.latencyMs[i];
			out[o++] = this.queue[i];
			out[o++] = this.curReplicas[i];
			out[o++] = this.dead[i] ? 2 : this.degraded[i] ? 1 : 0;
		}
		const breakerStateByEdge = new Map<number, number>();
		for (const b of this.breakers) breakerStateByEdge.set(b.edgeIdx, b.state);
		for (let k = 0; k < this.e; k++) {
			out[o++] = this.edgeFlow[k];
			out[o++] = this.edgeRetryFlow[k];
			const t = this.edgeTargetIdx[k];
			out[o++] = t >= 0 && this.util[t] >= UTILIZATION_CRITICAL ? 1 : 0;
			out[o++] = this.edgeDown[k] ? 3 : (breakerStateByEdge.get(k) ?? 0);
		}
		for (const group of this.groups) {
			out[o++] = group.lag;
			out[o++] = group.consumeRate;
			out[o++] = group.dlqRate;
			out[o++] = group.lostRate;
		}
		const tot = this.totals();
		out[o++] = tot.offered;
		out[o++] = tot.delivered;
		out[o++] = tot.failed;
		out[o++] = tot.pathLatencyMs;
		out[o++] = tot.bottleneckIdx;
		return o - base;
	}

	totals(): {
		offered: number;
		delivered: number;
		failed: number;
		pathLatencyMs: number;
		bottleneckIdx: number;
	} {
		const offered = this.entrySet.size > 0 ? this.inRateSum(this.entrySet) : 0;
		let failed = 0;
		let bottleneckIdx = -1;
		let worstUtil = UTILIZATION_CRITICAL;
		for (let i = 0; i < this.n; i++) {
			failed += this.errorRate[i] + this.droppedRate[i] + this.timeoutRate[i];
			if (this.util[i] > worstUtil && this.inRate[i] > 0) {
				worstUtil = this.util[i];
				bottleneckIdx = i;
			}
		}
		return {
			offered,
			delivered: Math.max(0, offered - failed),
			failed,
			pathLatencyMs: this.pathLatencyMs(),
			bottleneckIdx
		};
	}

	private inRateSum(set: Set<number>): number {
		let sum = 0;
		for (const i of set) sum += this.inRate[i];
		return sum;
	}

	nodeState(id: string) {
		const i = this.idToIdx.get(id);
		if (i === undefined) return null;
		return {
			inRate: this.inRate[i],
			served: this.served[i],
			errorRate: this.errorRate[i],
			droppedRate: this.droppedRate[i],
			timeoutRate: this.timeoutRate[i],
			retryInRate: this.retryIn[i],
			utilization: this.util[i],
			latencyMs: this.latencyMs[i],
			queueDepth: this.queue[i],
			replicas: this.curReplicas[i],
			hitRatio: this.curHitRatio[i],
			health: this.dead[i] ? 2 : this.degraded[i] ? 1 : 0
		};
	}

	groupState(topicNodeId: string, groupId: string) {
		const key = `${topicNodeId}/${groupId}`;
		const gi = this.indexMaps.groupIndex[key];
		if (gi === undefined) return null;
		const group = this.groups[gi];
		return {
			lag: group.lag,
			consumeRate: group.consumeRate,
			dlqRate: group.dlqRate,
			lostRate: group.lostRate
		};
	}
}
