export interface SloTarget {
	targetLatencyMs: number;

	targetAvailability: number;
}

export interface SloSample {
	offered: number;
	delivered: number;
	pathLatencyMs: number;
}

export interface SloReport {
	samples: number;

	availability: number;

	latencyCompliance: number;

	budgetBurn: number;
	availabilityPass: boolean;
	latencyPass: boolean;
	pass: boolean;
}

export const DEFAULT_SLO: SloTarget = { targetLatencyMs: 200, targetAvailability: 0.999 };

export function evaluateSlo(history: SloSample[], slo: SloTarget): SloReport | null {
	const samples = history.filter((h) => h.offered > 0);
	if (samples.length === 0) return null;

	let offered = 0;
	let delivered = 0;
	let latencyOk = 0;
	for (const s of samples) {
		offered += s.offered;
		delivered += Math.min(s.delivered, s.offered);
		if (s.pathLatencyMs <= slo.targetLatencyMs) latencyOk++;
	}
	const availability = offered > 0 ? delivered / offered : 1;
	const latencyCompliance = latencyOk / samples.length;
	const allowed = Math.max(1e-9, 1 - slo.targetAvailability);
	const budgetBurn = (1 - availability) / allowed;
	const availabilityPass = availability >= slo.targetAvailability;

	const latencyPass = latencyCompliance >= slo.targetAvailability;
	return {
		samples: samples.length,
		availability,
		latencyCompliance,
		budgetBurn,
		availabilityPass,
		latencyPass,
		pass: availabilityPass && latencyPass
	};
}

export function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
	return sorted[rank];
}
