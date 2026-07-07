import { DT, SimEngine } from '../engine';
import type { SimConfig, SimGraphSpec } from '../types';
import type { FromWorker, ToWorker } from './protocol';

const MAX_TICKS_PER_WAKE = 64;
const WAKE_MS = 15;
const BATCH_FRAMES = 8;
const BATCH_MAX_WALL_MS = 50;

let engine: SimEngine | null = null;
let spec: SimGraphSpec | null = null;
let config: SimConfig | null = null;
let running = false;
let speed = 1;
let simBudget = 0;
let lastWake = 0;
let timer: ReturnType<typeof setTimeout> | null = null;

let batch: Float32Array | null = null;
let batchFrames = 0;
let batchStartedWall = 0;

function post(msg: FromWorker, transfer?: Transferable[]): void {
	(postMessage as (m: FromWorker, t?: Transferable[]) => void)(msg, transfer);
}

function initEngine(): void {
	if (!spec || !config) return;
	engine = new SimEngine(spec, config);
	simBudget = 0;
	batch = null;
	batchFrames = 0;
	post({
		t: 'READY',
		indexMaps: engine.indexMaps,
		nodeCount: spec.nodes.length,
		edgeCount: spec.edges.length,
		groupCount: engine.groupCount,
		stride: engine.stride,
		warnings: engine.warnings
	});
}

function flushBatch(): void {
	if (!engine) return;
	const events = engine.drainEvents();
	if (events.length > 0) post({ t: 'SIM_EVENTS', events });
	if (!batch || batchFrames === 0) return;
	const buf = batch.buffer as ArrayBuffer;
	post({ t: 'METRICS_BATCH', frames: batchFrames, stride: engine.stride, buf }, [buf]);
	batch = null;
	batchFrames = 0;
}

function recordFrame(): void {
	if (!engine) return;
	if (!batch) {
		batch = new Float32Array(engine.stride * BATCH_FRAMES);
		batchFrames = 0;
		batchStartedWall = performance.now();
	}
	engine.writeFrame(batch, batchFrames * engine.stride);
	batchFrames++;
	if (batchFrames >= BATCH_FRAMES || performance.now() - batchStartedWall >= BATCH_MAX_WALL_MS) {
		flushBatch();
	}
}

function loop(): void {
	if (!running || !engine || !config) return;
	const now = performance.now();
	const wallDelta = (now - lastWake) / 1000;
	lastWake = now;
	simBudget += wallDelta * speed;

	let ticks = Math.floor(simBudget / DT);
	if (ticks > MAX_TICKS_PER_WAKE) {
		post({
			t: 'WARNING',
			message: `Sim fell behind wall clock; dropped ${((ticks - MAX_TICKS_PER_WAKE) * DT).toFixed(1)}s of sim time.`
		});
		ticks = MAX_TICKS_PER_WAKE;
		simBudget = ticks * DT;
	}
	for (let i = 0; i < ticks; i++) {
		engine.tick();
		recordFrame();
		if (engine.simTime >= config.durationSec) {
			flushBatch();
			running = false;
			post({ t: 'DONE', reason: 'duration-reached' });
			return;
		}
	}
	simBudget -= ticks * DT;
	if (batchFrames > 0 && performance.now() - batchStartedWall >= BATCH_MAX_WALL_MS) flushBatch();
	timer = setTimeout(loop, WAKE_MS);
}

onmessage = (event: MessageEvent<ToWorker>) => {
	const msg = event.data;
	try {
		switch (msg.t) {
			case 'INIT':
				spec = msg.graph;
				config = msg.config;
				running = false;
				if (timer) clearTimeout(timer);
				initEngine();
				break;
			case 'START':
				if (!engine) return;
				if (!running) {
					running = true;
					lastWake = performance.now();
					loop();
				}
				break;
			case 'PAUSE':
				running = false;
				if (timer) clearTimeout(timer);
				flushBatch();
				break;
			case 'STEP':
				if (!engine || running) return;
				for (let i = 0; i < msg.ticks; i++) {
					engine.tick();
					recordFrame();
				}
				flushBatch();
				break;
			case 'SET_SPEED':
				speed = Math.min(60, Math.max(0.25, msg.speed));
				break;
			case 'SET_TRAFFIC':
				engine?.setProfile(msg.profile);
				if (config) config.profile = msg.profile;
				break;
			case 'INJECT_EVENT':
				engine?.inject_(msg.event);
				break;
			case 'RESET':
				running = false;
				if (timer) clearTimeout(timer);
				initEngine();
				break;
		}
	} catch (err) {
		post({ t: 'ERROR', message: err instanceof Error ? err.message : String(err) });
	}
};
