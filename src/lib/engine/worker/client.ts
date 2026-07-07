import {
	EDGE_STRIDE,
	FRAME_HEADER,
	GROUP_STRIDE,
	NODE_STRIDE,
	TOTALS_STRIDE,
	type IndexMaps,
	type InjectedEvent,
	type SimEvent,
	type SimConfig,
	type SimGraphSpec,
	type TrafficProfile
} from '../types';
import type { FromWorker, ToWorker } from './protocol';

export interface DecodedNodeMetrics {
	inRate: number;
	servedRate: number;
	errorRate: number;
	droppedRate: number;
	timeoutRate: number;
	retryInRate: number;
	utilization: number;
	latencyMs: number;
	queueDepth: number;
	replicas: number;
	health: 0 | 1 | 2;
}

export interface DecodedFrame {
	simTime: number;
	nodes: Map<string, DecodedNodeMetrics>;
	edgeFlow: Map<
		string,
		{ flowRate: number; retryFlow: number; saturated: boolean; linkState: 0 | 1 | 2 | 3 }
	>;
	groups: Map<string, { lag: number; consumeRate: number; dlqRate: number; lostRate: number }>;
	totals: {
		offeredRps: number;
		deliveredRps: number;
		erroredRps: number;
		pathLatencyMs: number;
		bottleneckNodeId: string | null;
	};
}

export interface SimClientCallbacks {
	onReady?(info: { warnings: string[] }): void;
	onFrame?(frame: DecodedFrame): void;
	onEvents?(events: SimEvent[]): void;
	onWarning?(message: string): void;
	onDone?(reason: string): void;
	onError?(message: string): void;
}

export class SimWorkerClient {
	private worker: Worker;
	private callbacks: SimClientCallbacks;
	private indexMaps: IndexMaps | null = null;
	private nodeIds: string[] = [];
	private edgeIds: string[] = [];
	private groupKeys: string[] = [];

	constructor(callbacks: SimClientCallbacks) {
		this.callbacks = callbacks;
		this.worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
		this.worker.onmessage = (event: MessageEvent<FromWorker>) => this.handle(event.data);
	}

	private handle(msg: FromWorker): void {
		switch (msg.t) {
			case 'READY': {
				this.indexMaps = msg.indexMaps;
				this.nodeIds = invert(msg.indexMaps.nodeIndex);
				this.edgeIds = invert(msg.indexMaps.edgeIndex);
				this.groupKeys = invert(msg.indexMaps.groupIndex);
				this.callbacks.onReady?.({ warnings: msg.warnings });
				break;
			}
			case 'METRICS_BATCH': {
				if (!this.indexMaps) return;
				const data = new Float32Array(msg.buf);

				const offset = (msg.frames - 1) * msg.stride;
				this.callbacks.onFrame?.(this.decodeFrame(data, offset));
				break;
			}
			case 'SIM_EVENTS':
				this.callbacks.onEvents?.(msg.events);
				break;
			case 'WARNING':
				this.callbacks.onWarning?.(msg.message);
				break;
			case 'DONE':
				this.callbacks.onDone?.(msg.reason);
				break;
			case 'ERROR':
				this.callbacks.onError?.(msg.message);
				break;
		}
	}

	private decodeFrame(data: Float32Array, base: number): DecodedFrame {
		let o = base;
		const simTime = data[o++];
		const nodes = new Map<string, DecodedNodeMetrics>();
		for (const id of this.nodeIds) {
			nodes.set(id, {
				inRate: data[o],
				servedRate: data[o + 1],
				errorRate: data[o + 2],
				droppedRate: data[o + 3],
				timeoutRate: data[o + 4],
				retryInRate: data[o + 5],
				utilization: data[o + 6],
				latencyMs: data[o + 7],
				queueDepth: data[o + 8],
				replicas: data[o + 9],
				health: data[o + 10] as 0 | 1 | 2
			});
			o += NODE_STRIDE;
		}
		const edgeFlow = new Map<
			string,
			{ flowRate: number; retryFlow: number; saturated: boolean; linkState: 0 | 1 | 2 | 3 }
		>();
		for (const id of this.edgeIds) {
			edgeFlow.set(id, {
				flowRate: data[o],
				retryFlow: data[o + 1],
				saturated: data[o + 2] > 0,
				linkState: data[o + 3] as 0 | 1 | 2 | 3
			});
			o += EDGE_STRIDE;
		}
		const groups = new Map<
			string,
			{ lag: number; consumeRate: number; dlqRate: number; lostRate: number }
		>();
		for (const key of this.groupKeys) {
			groups.set(key, {
				lag: data[o],
				consumeRate: data[o + 1],
				dlqRate: data[o + 2],
				lostRate: data[o + 3]
			});
			o += GROUP_STRIDE;
		}
		const bottleneckIdx = data[o + 4];
		return {
			simTime,
			nodes,
			edgeFlow,
			groups,
			totals: {
				offeredRps: data[o],
				deliveredRps: data[o + 1],
				erroredRps: data[o + 2],
				pathLatencyMs: data[o + 3],
				bottleneckNodeId: bottleneckIdx >= 0 ? (this.nodeIds[bottleneckIdx] ?? null) : null
			}
		};
	}

	init(graph: SimGraphSpec, config: SimConfig): void {
		this.send({ t: 'INIT', graph, config });
	}
	start(): void {
		this.send({ t: 'START' });
	}
	pause(): void {
		this.send({ t: 'PAUSE' });
	}
	step(ticks: number): void {
		this.send({ t: 'STEP', ticks });
	}
	setSpeed(speed: number): void {
		this.send({ t: 'SET_SPEED', speed });
	}
	setTraffic(profile: TrafficProfile): void {
		this.send({ t: 'SET_TRAFFIC', profile });
	}
	injectEvent(event: InjectedEvent): void {
		this.send({ t: 'INJECT_EVENT', event });
	}
	reset(): void {
		this.send({ t: 'RESET' });
	}
	terminate(): void {
		this.worker.terminate();
	}

	private send(msg: ToWorker): void {
		this.worker.postMessage(msg);
	}
}

function invert(index: Record<string, number>): string[] {
	const out: string[] = [];
	for (const [id, i] of Object.entries(index)) out[i] = id;
	return out;
}

export { FRAME_HEADER, NODE_STRIDE, EDGE_STRIDE, GROUP_STRIDE, TOTALS_STRIDE };
