export type Routing = 'fanout' | 'split' | 'topic';

export interface AutoscaleSpec {
	min: number;
	max: number;
	targetUtil: number;
	scaleOutDelaySec: number;
	scaleInDelaySec: number;
	warmupSec: number;
}

export interface CacheSpec {
	hitRatio: number;
	warmupSec: number;
}

export interface SimNodeSpec {
	id: string;
	componentId: string;
	label: string;
	maxQPS: number;
	replicas: number;
	baseLatencyMs: number;
	routing: Routing;

	entryRps?: number;

	queueBound: number;

	timeoutMs: number;
	autoscale?: AutoscaleSpec;
	cache?: CacheSpec;
}

export interface RetrySpec {
	max: number;
	backoffMs: number;
}

export interface BreakerSpec {
	errorThreshold: number;

	cooldownSec: number;
}

export interface SimEdgeSpec {
	id: string;
	source: string;
	target: string;
	kind: 'sync' | 'async' | 'pubsub';

	weight: number;
	retry?: RetrySpec;
	breaker?: BreakerSpec;

	poolSize?: number;

	extraLatencyMs?: number;
}

export interface SubscriberGroupSpec {
	id: string;
	memberNodeIds: string[];

	failureFraction: number;
	dlqNodeId?: string;
}

export interface TopicSpec {
	nodeId: string;
	partitions: number;

	partitionsCapParallelism: boolean;
	retentionMessages: number;

	backpressure: boolean;
	groups: SubscriberGroupSpec[];
}

export interface SimGraphSpec {
	nodes: SimNodeSpec[];
	edges: SimEdgeSpec[];
	topics: TopicSpec[];
}

export type TrafficProfile =
	| { kind: 'constant'; rps: number }
	| { kind: 'ramp'; fromRps: number; toRps: number; durationSec: number }
	| { kind: 'spike'; baseRps: number; spikeRps: number; atSec: number; durationSec: number }
	| { kind: 'diurnal'; meanRps: number; amplitude: number; periodSec: number };

export type InjectedEvent =
	| { type: 'kill-node'; nodeId: string; atSimTime?: number; recoverAfterSec?: number }
	| { type: 'revive-node'; nodeId: string; atSimTime?: number }
	| { type: 'traffic-mult'; factor: number; durationSec?: number; atSimTime?: number }
	| {
			type: 'latency-mult';
			nodeId: string;
			factor: number;
			durationSec?: number;
			atSimTime?: number;
	  }
	| {
			type: 'capacity-mult';
			nodeId: string;
			factor: number;
			durationSec?: number;
			atSimTime?: number;
	  }
	| { type: 'publish-burst'; topicId: string; messages: number; atSimTime?: number }
	| {
			type: 'error-inject';
			nodeId: string;
			fraction: number;
			durationSec?: number;
			atSimTime?: number;
	  }
	| { type: 'partition-edge'; edgeId: string; durationSec?: number; atSimTime?: number }
	| { type: 'restore-edge'; edgeId: string; atSimTime?: number }
	| { type: 'rolling-restart'; nodeId: string; perReplicaSec?: number; atSimTime?: number };

export interface SimConfig {
	seed: number;
	profile: TrafficProfile;

	durationSec: number;

	jitter?: number;
}

export type SimEventKind =
	| 'degraded'
	| 'recovered'
	| 'died'
	| 'revived'
	| 'backpressure-on'
	| 'backpressure-off'
	| 'queue-full'
	| 'scaled-out'
	| 'scaled-in'
	| 'lb-ejected'
	| 'hiccup'
	| 'breaker-open'
	| 'breaker-half-open'
	| 'breaker-closed'
	| 'partitioned'
	| 'restored'
	| 'deploy'
	| 'pool-exhausted';

export interface SimEvent {
	simTime: number;
	kind: SimEventKind;
	nodeId: string;
	detail?: string;
}

export const NODE_HEALTH = { healthy: 0, degraded: 1, dead: 2 } as const;

export const NODE_STRIDE = 11;
export const EDGE_STRIDE = 4;
export const GROUP_STRIDE = 4;
export const TOTALS_STRIDE = 5;
export const FRAME_HEADER = 1;

export function frameStride(nodeCount: number, edgeCount: number, groupCount: number): number {
	return (
		FRAME_HEADER +
		nodeCount * NODE_STRIDE +
		edgeCount * EDGE_STRIDE +
		groupCount * GROUP_STRIDE +
		TOTALS_STRIDE
	);
}

export interface IndexMaps {
	nodeIndex: Record<string, number>;
	edgeIndex: Record<string, number>;

	groupIndex: Record<string, number>;
}
