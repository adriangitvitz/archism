<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import { evaluateSlo } from '$lib/engine/slo';

	const { design, selection, sim } = getEditorContext();

	const sloReport = $derived(design.slo ? evaluateSlo(sim.history, design.slo) : null);

	const running = $derived(sim.status === 'running');
	const totals = $derived(sim.frame?.totals ?? null);
	const selectedNodeId = $derived(selection.nodeId);
	const selectedHealth = $derived(
		selectedNodeId ? (sim.frame?.nodes.get(selectedNodeId)?.health ?? 0) : 0
	);
	const selectedIsTopic = $derived.by(() => {
		if (!selectedNodeId) return false;
		const node = design.nodes.find((n) => n.id === selectedNodeId);
		const data = node?.data as
			{ componentId?: string; config?: { pubsub?: { role?: string } } } | undefined;
		return data?.componentId === 'pub-sub' || data?.config?.pubsub?.role === 'topic';
	});

	function fmt(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return n.toFixed(0);
	}

	const toSlider = (rps: number) => Math.log10(Math.max(10, rps));
	const fromSlider = (v: number) => Math.round(10 ** v);
</script>

<div
	class="flex h-14 shrink-0 items-center gap-3 border-t border-zinc-800 bg-zinc-950 px-3 text-xs"
>
	<button
		onclick={() => (running ? sim.pause() : sim.start(design))}
		class={`w-20 rounded-md px-3 py-1.5 font-semibold ${running ? 'bg-amber-600 hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500'} text-white`}
	>
		{running ? 'Pause' : 'Simulate'}
	</button>
	<button
		onclick={() => sim.reset(design)}
		class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-zinc-500"
	>
		Reset
	</button>
	{#if sim.recorded.length > 0}
		<button
			onclick={() => sim.replay(design)}
			title={`Re-run the exact same scenario (${sim.recorded.length} recorded events, same seed)`}
			class="rounded-md border border-violet-800 px-2 py-1.5 text-violet-300 hover:border-violet-500"
		>
			Replay ({sim.recorded.length})
		</button>
		<button
			onclick={() => sim.clearRecording()}
			title="Discard the recorded scenario and start a fresh tape"
			class="rounded-md border border-zinc-700 px-1.5 py-1.5 text-zinc-400 hover:border-rose-500 hover:text-rose-300"
		>
			✕
		</button>
	{/if}
	<button
		onclick={() => sim.step(1)}
		disabled={running || sim.status === 'idle'}
		title="Advance one 100ms tick"
		class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
	>
		Step
	</button>

	<div class="ml-2 flex items-center gap-2">
		<span class="text-zinc-500">RPS</span>
		<input
			type="range"
			min="1"
			max="6"
			step="0.05"
			value={toSlider(sim.rps)}
			oninput={(e) => sim.setRps(fromSlider(Number(e.currentTarget.value)))}
			class="w-36 accent-cyan-500"
		/>
		<span class="w-12 font-mono text-zinc-200">{fmt(sim.rps)}</span>
	</div>

	<div class="flex items-center gap-1">
		<span class="text-zinc-500">Speed</span>
		<select
			value={String(sim.speed)}
			onchange={(e) => sim.setSpeed(Number(e.currentTarget.value))}
			class="rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-zinc-200"
		>
			{#each ['0.25', '0.5', '1', '2', '5', '10', '30'] as s (s)}
				<option value={s}>{s}×</option>
			{/each}
		</select>
	</div>

	<div class="h-6 w-px bg-zinc-800"></div>

	<div class="flex items-center gap-1.5">
		<button
			onclick={() => sim.inject({ type: 'traffic-mult', factor: 10, durationSec: 10 })}
			disabled={sim.status === 'idle'}
			title="Multiply offered traffic ×10 for 10 sim-seconds"
			class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-amber-500 disabled:opacity-40"
		>
			Spike ×10
		</button>
		<button
			onclick={() =>
				selectedNodeId &&
				sim.inject(
					selectedHealth === 2
						? { type: 'revive-node', nodeId: selectedNodeId }
						: { type: 'kill-node', nodeId: selectedNodeId }
				)}
			disabled={sim.status === 'idle' || !selectedNodeId}
			title="Kill (or revive) the selected node"
			class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-rose-500 disabled:opacity-40"
		>
			{selectedHealth === 2 ? 'Revive node' : 'Kill node'}
		</button>
		<button
			onclick={() =>
				selectedNodeId &&
				sim.inject({ type: 'latency-mult', nodeId: selectedNodeId, factor: 5, durationSec: 15 })}
			disabled={sim.status === 'idle' || !selectedNodeId}
			title="Slow the selected node ×5 for 15 sim-seconds"
			class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-amber-500 disabled:opacity-40"
		>
			Slow ×5
		</button>
		<button
			onclick={() =>
				selectedNodeId &&
				sim.inject({
					type: 'error-inject',
					nodeId: selectedNodeId,
					fraction: 0.5,
					durationSec: 15
				})}
			disabled={sim.status === 'idle' || !selectedNodeId}
			title="Make the selected node fail 50% of requests for 15 sim-seconds"
			class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-rose-500 disabled:opacity-40"
		>
			Err 50%
		</button>
		<button
			onclick={() =>
				selectedNodeId &&
				sim.inject({ type: 'rolling-restart', nodeId: selectedNodeId, perReplicaSec: 10 })}
			disabled={sim.status === 'idle' || !selectedNodeId}
			title="Rolling restart: bounce the selected node's replicas one at a time (10s each)"
			class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-cyan-500 disabled:opacity-40"
		>
			Deploy
		</button>
		{#if selection.edgeId}
			{@const edgeState = sim.frame?.edgeFlow.get(selection.edgeId)?.linkState ?? 0}
			<button
				onclick={() =>
					sim.inject(
						edgeState === 3
							? { type: 'restore-edge', edgeId: selection.edgeId! }
							: { type: 'partition-edge', edgeId: selection.edgeId! }
					)}
				disabled={sim.status === 'idle'}
				title="Partition (or restore) the selected connection"
				class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-rose-500 disabled:opacity-40"
			>
				{edgeState === 3 ? 'Restore link' : 'Partition'}
			</button>
		{/if}
		{#if selectedIsTopic}
			<button
				onclick={() =>
					selectedNodeId &&
					sim.inject({ type: 'publish-burst', topicId: selectedNodeId, messages: 10000 })}
				disabled={sim.status === 'idle'}
				title="Publish a burst of 10,000 messages to the selected topic"
				class="rounded-md border border-zinc-700 px-2 py-1.5 text-zinc-300 hover:border-violet-500 disabled:opacity-40"
			>
				Burst 10k
			</button>
		{/if}
	</div>

	<div class="flex-1"></div>

	{#if sim.stale}
		<button
			onclick={() => sim.reset(design)}
			class="rounded-md border border-amber-600 px-2 py-1 text-amber-400 hover:bg-amber-950"
			title="The design changed since the simulation started - reset to pick up the new graph."
		>
			⚠ design changed - reset sim
		</button>
	{/if}
	{#if sim.errorMessage}
		<span class="text-rose-400">{sim.errorMessage}</span>
	{/if}
	{#if sloReport}
		<span
			class={`rounded px-1.5 py-0.5 font-mono text-[12.5px] font-bold ${sloReport.pass ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}
			title={`availability ${(sloReport.availability * 100).toFixed(3)}% · latency compliance ${(sloReport.latencyCompliance * 100).toFixed(1)}% · budget burn ${(sloReport.budgetBurn * 100).toFixed(0)}%`}
		>
			SLO {sloReport.pass ? '✓' : '✗'}
		</span>
	{/if}
	{#if totals}
		<div class="flex items-center gap-3 font-mono text-[13.5px]">
			<span class="text-zinc-500">t={sim.frame!.simTime.toFixed(1)}s</span>
			<span class="text-zinc-300">in {fmt(totals.offeredRps)}/s</span>
			<span class="text-emerald-400">ok {fmt(totals.deliveredRps)}/s</span>
			<span class={totals.erroredRps > 0 ? 'text-rose-400' : 'text-zinc-600'}
				>err {fmt(totals.erroredRps)}/s</span
			>
			<span class="text-zinc-300">p-lat {totals.pathLatencyMs.toFixed(0)}ms</span>
			{#if totals.bottleneckNodeId}
				<button
					class="text-rose-400 hover:underline"
					onclick={() => selection.selectNode(totals.bottleneckNodeId)}
				>
					bottleneck: {totals.bottleneckNodeId.split('-').slice(0, -1).join('-') ||
						totals.bottleneckNodeId}
				</button>
			{/if}
		</div>
	{/if}
</div>
