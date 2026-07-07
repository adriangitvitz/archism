<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import Sparkline from '../common/Sparkline.svelte';
	import type { SimEventKind } from '$lib/engine/types';
	import { DEFAULT_SLO, evaluateSlo, percentile } from '$lib/engine/slo';
	import { pubSubSemantics } from '$lib/catalog/pubsub-semantics';
	import type { ComponentNodeData } from '$lib/stores/design.svelte';

	const { design, selection, sim, readOnly } = getEditorContext();

	const assumptions = $derived.by(() => {
		const out: string[] = [];
		const datas = design.nodes.map((n) => n.data as ComponentNodeData);

		out.push(
			'Rate-based fluid model: flows are continuous averages, not per-message events - faithful for steady-state throughput and saturation, not single-request tail latency.'
		);

		const hasTopic = datas.some(
			(d) => d.componentId === 'pub-sub' || d.config.pubsub?.role === 'topic'
		);
		if (hasTopic) {
			const sem = pubSubSemantics(design.provider);
			out.push(`Pub/sub modeled as ${sem.product} - ${sem.note}`);
		}
		const hasDlq = datas.some(
			(d) => d.config.pubsub?.dlqNodeId || (d.config.pubsub?.failureFraction ?? 0) > 0
		);
		if (hasDlq) {
			out.push(
				'Dead-lettering is an instant failure fraction of consumed messages, not delivery-attempt exhaustion - transient blips may over-route to the DLQ versus real redelivery.'
			);
		}

		const slowDefaulted = datas.filter(
			(d) => d.componentId === 'custom' && d.config.latencyMsOverride === undefined
		);
		if (slowDefaulted.length > 0) {
			out.push(
				`${slowDefaulted.length} custom/external node(s) use the catalog default latency - set "Service latency" on slow externals (e.g. SAP, third-party APIs) or path latency is understated.`
			);
		}

		out.push(
			'Offered traffic is a constant rate from the slider - scheduled/bursty workloads (cron batches, spikes) are only modeled when you inject them.'
		);
		return out;
	});

	const history = $derived(sim.history);
	const last = $derived(history.at(-1));

	const latencies = $derived(history.filter((h) => h.offered > 0).map((h) => h.pathLatencyMs));
	const p50 = $derived(percentile(latencies, 50));
	const p95 = $derived(percentile(latencies, 95));
	const p99 = $derived(percentile(latencies, 99));

	const slo = $derived(design.slo ?? DEFAULT_SLO);
	const sloEnabled = $derived(!!design.slo);
	const sloReport = $derived(sloEnabled ? evaluateSlo(history, slo) : null);
	const nines = $derived((slo.targetAvailability * 100).toFixed(2).replace(/\.?0+$/, ''));

	const selectedSeries = $derived.by(() => {
		void sim.frame;
		return selection.nodeId ? sim.seriesFor(selection.nodeId) : [];
	});
	const selectedLabel = $derived.by(() => {
		const node = design.nodes.find((n) => n.id === selection.nodeId);
		return (node?.data as { label?: string } | undefined)?.label ?? selection.nodeId ?? '';
	});

	function fmt(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return n.toFixed(0);
	}

	const EVENT_STYLES: Partial<Record<SimEventKind, string>> = {
		died: 'text-rose-400',
		revived: 'text-emerald-400',
		degraded: 'text-amber-400',
		recovered: 'text-emerald-400',
		'backpressure-on': 'text-amber-400',
		'backpressure-off': 'text-zinc-400',
		'queue-full': 'text-rose-400',
		'scaled-out': 'text-cyan-400',
		'scaled-in': 'text-cyan-600',
		'lb-ejected': 'text-rose-400',
		hiccup: 'text-zinc-400'
	};

	function labelFor(nodeId: string): string {
		const node = design.nodes.find((n) => n.id === nodeId);
		return (node?.data as { label?: string } | undefined)?.label ?? nodeId;
	}
</script>

<div class="space-y-3 p-3">
	<div class="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
		<div class="flex items-center justify-between">
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					checked={sloEnabled}
					disabled={readOnly}
					onchange={(e) => design.setSlo(e.currentTarget.checked ? { ...DEFAULT_SLO } : undefined)}
					class="accent-emerald-500"
				/>
				<span class="text-xs font-semibold text-zinc-200">SLO verification</span>
			</label>
			{#if sloReport}
				<span
					class={`rounded px-2 py-0.5 text-[12.5px] font-bold ${sloReport.pass ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}
				>
					{sloReport.pass ? 'PASS' : 'FAIL'}
				</span>
			{/if}
		</div>
		{#if sloEnabled}
			<div class="grid grid-cols-2 gap-2">
				<label class="block">
					<span class="text-[12.5px] text-zinc-400">p-latency ≤ (ms)</span>
					<input
						type="number"
						min="1"
						value={slo.targetLatencyMs}
						disabled={readOnly}
						oninput={(e) =>
							design.setSlo({
								...slo,
								targetLatencyMs: Math.max(1, Number(e.currentTarget.value) || 1)
							})}
						class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
					/>
				</label>
				<label class="block">
					<span class="text-[12.5px] text-zinc-400">availability %</span>
					<input
						type="number"
						min="90"
						max="99.999"
						step="0.001"
						value={slo.targetAvailability * 100}
						disabled={readOnly}
						oninput={(e) =>
							design.setSlo({
								...slo,
								targetAvailability: Math.min(
									0.99999,
									Math.max(0.9, Number(e.currentTarget.value) / 100)
								)
							})}
						class="mt-0.5 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
					/>
				</label>
			</div>
			{#if sloReport}
				<div class="space-y-1 font-mono text-[12.5px]">
					<p class={sloReport.availabilityPass ? 'text-emerald-400' : 'text-rose-400'}>
						availability {(sloReport.availability * 100).toFixed(3)}% (target {nines}%)
					</p>
					<p class={sloReport.latencyPass ? 'text-emerald-400' : 'text-rose-400'}>
						latency ≤{slo.targetLatencyMs}ms in {(sloReport.latencyCompliance * 100).toFixed(1)}% of
						samples
					</p>
					<div>
						<span class="text-zinc-500">error budget burn</span>
						<div class="mt-0.5 h-1.5 overflow-hidden rounded bg-zinc-800">
							<div
								class={`h-full ${sloReport.budgetBurn >= 1 ? 'bg-rose-500' : sloReport.budgetBurn > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
								style={`width:${Math.min(100, sloReport.budgetBurn * 100)}%`}
							></div>
						</div>
						<span class={sloReport.budgetBurn >= 1 ? 'text-rose-400' : 'text-zinc-400'}>
							{(sloReport.budgetBurn * 100).toFixed(1)}% consumed over {sloReport.samples}s
						</span>
					</div>
				</div>
			{:else}
				<p class="text-[12.5px] text-zinc-600">Run the simulation to evaluate.</p>
			{/if}
		{/if}
	</div>

	{#if history.length < 2}
		<p class="text-xs text-zinc-600">
			Run the simulation to build the timeline - charts sample once per sim-second.
		</p>
	{:else}
		<div class="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
			<Sparkline
				points={history.map((h) => h.offered)}
				color="#d4a574"
				width={116}
				label="offered/s"
				value={fmt(last!.offered)}
			/>
			<Sparkline
				points={history.map((h) => h.delivered)}
				color="#a8b884"
				width={116}
				label="goodput/s"
				value={fmt(last!.delivered)}
			/>
			<Sparkline
				points={history.map((h) => h.errored)}
				color="#e89070"
				width={116}
				label="failed/s"
				value={fmt(last!.errored)}
			/>
			<Sparkline
				points={history.map((h) => h.pathLatencyMs)}
				color="#d9988a"
				width={116}
				label="path latency"
				value={`${fmt(last!.pathLatencyMs)}ms`}
			/>
			<p class="col-span-2 font-mono text-[12.5px] text-zinc-400">
				latency p50 <span class="text-zinc-200">{fmt(p50)}ms</span> · p95
				<span class="text-zinc-200">{fmt(p95)}ms</span> · p99
				<span class={p99 > slo.targetLatencyMs && sloEnabled ? 'text-rose-400' : 'text-zinc-200'}
					>{fmt(p99)}ms</span
				>
				<span class="text-zinc-600">(measured over {latencies.length}s)</span>
			</p>
		</div>

		{#if selection.nodeId && selectedSeries.length > 1}
			<div class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
				<p class="mb-1.5 truncate text-[12.5px] font-semibold text-zinc-300">{selectedLabel}</p>
				<div class="grid grid-cols-2 gap-3">
					<Sparkline
						points={selectedSeries.map((p) => p.inRate)}
						color="#d4a574"
						width={116}
						label="in/s"
						value={fmt(selectedSeries.at(-1)!.inRate)}
					/>
					<Sparkline
						points={selectedSeries.map((p) => p.utilization * 100)}
						color="#e8b55e"
						width={116}
						label="util %"
						value={`${(selectedSeries.at(-1)!.utilization * 100).toFixed(0)}%`}
					/>
				</div>
			</div>
		{/if}
	{/if}

	<div>
		<p class="mb-1 text-[12.5px] font-semibold tracking-wide text-zinc-500 uppercase">
			Incidents ({sim.incidents.length})
		</p>
		{#if sim.incidents.length === 0}
			<p class="text-[13.5px] text-zinc-600">
				No incidents yet - inject chaos or overload something.
			</p>
		{:else}
			<ul class="space-y-0.5">
				{#each [...sim.incidents].reverse() as event, i (i)}
					<li>
						<button
							onclick={() => selection.selectNode(event.nodeId)}
							class="flex w-full items-baseline gap-2 rounded px-1.5 py-0.5 text-left font-mono text-[12.5px] hover:bg-zinc-800/60"
						>
							<span class="shrink-0 text-zinc-600">t={event.simTime.toFixed(1)}s</span>
							<span class={`shrink-0 font-semibold ${EVENT_STYLES[event.kind] ?? 'text-zinc-300'}`}>
								{event.kind}
							</span>
							<span class="truncate text-zinc-400">
								{labelFor(event.nodeId)}{event.detail ? ` - ${event.detail}` : ''}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<details class="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
		<summary
			class="cursor-pointer text-[12.5px] font-semibold tracking-wide text-zinc-500 uppercase"
		>
			Model assumptions ({assumptions.length})
		</summary>
		<ul class="mt-1.5 space-y-1.5">
			{#each assumptions as note, i (i)}
				<li class="flex gap-1.5 text-[12.5px] leading-snug text-zinc-400">
					<span class="text-zinc-600">•</span>
					<span>{note}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-2 text-[11.5px] text-zinc-600">
			These are approximations ArchSim makes for this design - verify against provider docs before
			treating a result as ground truth.
		</p>
	</details>
</div>
