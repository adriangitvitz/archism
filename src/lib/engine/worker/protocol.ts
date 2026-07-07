import type {
	IndexMaps,
	InjectedEvent,
	SimConfig,
	SimEvent,
	SimGraphSpec,
	TrafficProfile
} from '../types';

export type ToWorker =
	| { t: 'INIT'; graph: SimGraphSpec; config: SimConfig }
	| { t: 'START' }
	| { t: 'PAUSE' }
	| { t: 'STEP'; ticks: number }
	| { t: 'SET_SPEED'; speed: number }
	| { t: 'SET_TRAFFIC'; profile: TrafficProfile }
	| { t: 'INJECT_EVENT'; event: InjectedEvent }
	| { t: 'RESET' };

export type FromWorker =
	| {
			t: 'READY';
			indexMaps: IndexMaps;
			nodeCount: number;
			edgeCount: number;
			groupCount: number;
			stride: number;
			warnings: string[];
	  }
	| { t: 'METRICS_BATCH'; frames: number; stride: number; buf: ArrayBuffer }
	| { t: 'SIM_EVENTS'; events: SimEvent[] }
	| { t: 'WARNING'; message: string }
	| { t: 'DONE'; reason: 'duration-reached' | 'stopped' }
	| { t: 'ERROR'; message: string };
