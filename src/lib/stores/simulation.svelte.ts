import { SimWorkerClient, type DecodedFrame } from '$lib/engine/worker/client';
import { docToSimSpec } from '$lib/engine/adapters';
import type { InjectedEvent, SimEvent, TrafficProfile } from '$lib/engine/types';
import type { DesignStore } from './design.svelte';

export type SimStatus = 'idle' | 'ready' | 'running' | 'paused' | 'done' | 'error';

const DEFAULT_DURATION_SEC = 3600;
const JITTER = 0.04;
const MAX_HISTORY_POINTS = 900;
const MAX_INCIDENTS = 300;

export interface HistoryPoint {
	t: number;
	offered: number;
	delivered: number;
	errored: number;
	pathLatencyMs: number;
}

export interface NodePoint {
	t: number;
	inRate: number;
	utilization: number;
	latencyMs: number;
}

export class SimulationStore {
	status = $state<SimStatus>('idle');
	frame = $state<DecodedFrame | null>(null);
	warnings = $state<string[]>([]);
	errorMessage = $state<string | null>(null);

	stale = $state(false);

	rps = $state(1000);
	speed = $state(1);

	history = $state<HistoryPoint[]>([]);
	incidents = $state<SimEvent[]>([]);

	recorded = $state.raw<InjectedEvent[]>([]);
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- intentionally non-reactive; reads are keyed off `frame` changes
	private nodeSeries = new Map<string, NodePoint[]>();
	private lastSampleSec = -1;

	private client: SimWorkerClient | null = null;
	private initializedGraphVersion = -1;

	private ensureClient(): SimWorkerClient {
		if (!this.client) {
			this.client = new SimWorkerClient({
				onReady: ({ warnings }) => {
					this.warnings = warnings;
					this.status = 'ready';
				},
				onFrame: (frame) => {
					this.frame = frame;
					this.sample(frame);
				},
				onEvents: (events) => {
					this.incidents = [...this.incidents, ...events].slice(-MAX_INCIDENTS);
				},
				onWarning: (message) => {
					this.warnings = [...this.warnings.slice(-4), message];
				},
				onDone: () => {
					this.status = 'done';
				},
				onError: (message) => {
					this.errorMessage = message;
					this.status = 'error';
				}
			});
		}
		return this.client;
	}

	private sample(frame: DecodedFrame): void {
		const sec = Math.floor(frame.simTime);
		if (sec <= this.lastSampleSec) return;
		this.lastSampleSec = sec;
		this.history = [
			...this.history.slice(-(MAX_HISTORY_POINTS - 1)),
			{
				t: frame.simTime,
				offered: frame.totals.offeredRps,
				delivered: frame.totals.deliveredRps,
				errored: frame.totals.erroredRps,
				pathLatencyMs: frame.totals.pathLatencyMs
			}
		];
		for (const [id, m] of frame.nodes) {
			let series = this.nodeSeries.get(id);
			if (!series) {
				series = [];
				this.nodeSeries.set(id, series);
			}
			series.push({
				t: frame.simTime,
				inRate: m.inRate,
				utilization: m.utilization,
				latencyMs: m.latencyMs
			});
			if (series.length > MAX_HISTORY_POINTS) series.shift();
		}
	}

	seriesFor(nodeId: string): NodePoint[] {
		return this.nodeSeries.get(nodeId) ?? [];
	}

	profile(): TrafficProfile {
		return { kind: 'constant', rps: this.rps };
	}

	init(design: DesignStore): void {
		const client = this.ensureClient();
		this.errorMessage = null;
		this.frame = null;
		this.stale = false;
		this.history = [];
		this.incidents = [];
		this.nodeSeries.clear();
		this.lastSampleSec = -1;
		this.initializedGraphVersion = design.graphVersion;
		client.init(docToSimSpec(design.toDoc()), {
			seed: 42,
			profile: this.profile(),
			durationSec: DEFAULT_DURATION_SEC,
			jitter: JITTER
		});
	}

	start(design: DesignStore): void {
		if (
			this.status === 'idle' ||
			this.stale ||
			this.initializedGraphVersion !== design.graphVersion
		) {
			this.init(design);
		}
		this.ensureClient().setTraffic(this.profile());
		this.ensureClient().setSpeed(this.speed);
		this.ensureClient().start();
		this.status = 'running';
	}

	pause(): void {
		this.client?.pause();
		if (this.status === 'running') this.status = 'paused';
	}

	step(ticks = 1): void {
		this.client?.step(ticks);
		if (this.status === 'running') this.status = 'paused';
	}

	reset(design: DesignStore): void {
		this.init(design);
	}

	stop(): void {
		this.client?.pause();
		this.status = this.frame ? 'paused' : 'ready';
	}

	setRps(rps: number): void {
		this.rps = rps;
		this.client?.setTraffic(this.profile());
	}

	setSpeed(speed: number): void {
		this.speed = speed;
		this.client?.setSpeed(speed);
	}

	inject(event: InjectedEvent): void {
		const stamped = { ...event, atSimTime: event.atSimTime ?? this.frame?.simTime ?? 0 };
		this.recorded = [...this.recorded, stamped];
		this.client?.injectEvent(stamped);
	}

	replay(design: DesignStore): void {
		const events = this.recorded;
		this.init(design);
		const client = this.ensureClient();

		for (const event of events) client.injectEvent(event);
		client.setTraffic(this.profile());
		client.setSpeed(this.speed);
		client.start();
		this.status = 'running';
	}

	clearRecording(): void {
		this.recorded = [];
	}

	markStale(): void {
		if (this.status !== 'idle') this.stale = true;
	}

	destroy(): void {
		this.client?.terminate();
		this.client = null;
		this.status = 'idle';
		this.frame = null;
	}
}
