import type { TrafficProfile } from './types';

export function evalTrafficProfile(profile: TrafficProfile, simTime: number): number {
	switch (profile.kind) {
		case 'constant':
			return profile.rps;
		case 'ramp': {
			if (profile.durationSec <= 0) return profile.toRps;
			const t = Math.min(1, Math.max(0, simTime / profile.durationSec));
			return profile.fromRps + (profile.toRps - profile.fromRps) * t;
		}
		case 'spike': {
			const inSpike = simTime >= profile.atSec && simTime < profile.atSec + profile.durationSec;
			return inSpike ? profile.spikeRps : profile.baseRps;
		}
		case 'diurnal': {
			const phase = (2 * Math.PI * simTime) / Math.max(1, profile.periodSec);
			return Math.max(0, profile.meanRps * (1 + profile.amplitude * Math.sin(phase)));
		}
	}
}
