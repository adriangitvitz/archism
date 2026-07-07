import { describe, expect, it } from 'vitest';
import { evaluateSlo, percentile, type SloSample } from './slo';

const SLO = { targetLatencyMs: 200, targetAvailability: 0.99 };

function sample(offered: number, delivered: number, pathLatencyMs: number): SloSample {
	return { offered, delivered, pathLatencyMs };
}

describe('evaluateSlo', () => {
	it('returns null with no traffic', () => {
		expect(evaluateSlo([], SLO)).toBeNull();
		expect(evaluateSlo([sample(0, 0, 10)], SLO)).toBeNull();
	});

	it('passes a clean run', () => {
		const history = Array.from({ length: 100 }, () => sample(1000, 1000, 50));
		const report = evaluateSlo(history, SLO)!;
		expect(report.pass).toBe(true);
		expect(report.availability).toBe(1);
		expect(report.latencyCompliance).toBe(1);
		expect(report.budgetBurn).toBe(0);
	});

	it('fails availability and reports budget burn when errors exceed the allowance', () => {
		const history = Array.from({ length: 100 }, () => sample(1000, 980, 50));
		const report = evaluateSlo(history, SLO)!;
		expect(report.availabilityPass).toBe(false);
		expect(report.pass).toBe(false);
		expect(report.budgetBurn).toBeCloseTo(2.0, 5);
	});

	it('fails latency when too many samples breach the target', () => {
		const good = Array.from({ length: 90 }, () => sample(1000, 1000, 50));
		const bad = Array.from({ length: 10 }, () => sample(1000, 1000, 500));
		const report = evaluateSlo([...good, ...bad], SLO)!;
		expect(report.latencyCompliance).toBeCloseTo(0.9, 5);
		expect(report.latencyPass).toBe(false);
		expect(report.availabilityPass).toBe(true);
		expect(report.pass).toBe(false);
	});

	it('a brief incident within budget still passes', () => {
		const history = [
			...Array.from({ length: 999 }, () => sample(1000, 1000, 50)),
			sample(1000, 500, 150)
		];
		const report = evaluateSlo(history, SLO)!;
		expect(report.availabilityPass).toBe(true);
		expect(report.budgetBurn).toBeLessThan(0.06);
		expect(report.pass).toBe(true);
	});

	it('delivered is clamped to offered (fan-out duplication cannot inflate availability)', () => {
		const report = evaluateSlo([sample(1000, 1500, 50)], SLO)!;
		expect(report.availability).toBe(1);
	});
});

describe('percentile', () => {
	it('nearest-rank percentiles', () => {
		const vals = Array.from({ length: 100 }, (_, i) => i + 1);
		expect(percentile(vals, 50)).toBe(50);
		expect(percentile(vals, 95)).toBe(95);
		expect(percentile(vals, 99)).toBe(99);
		expect(percentile([42], 99)).toBe(42);
		expect(percentile([], 99)).toBe(0);
	});
});
