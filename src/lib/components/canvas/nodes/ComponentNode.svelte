<script lang="ts">
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import type { ComponentNodeData } from '$lib/stores/design.svelte';
	import { getEditorContext } from '$lib/stores/context';
	import { getComponentById } from '$lib/catalog/components';
	import { resolveSkin } from '$lib/catalog/providers';
	import 'iconify-icon';

	let { id, data, selected }: NodeProps = $props();

	const { design, selection, sim } = getEditorContext();

	const nodeData = $derived(data as ComponentNodeData);
	const spec = $derived(getComponentById(nodeData.componentId));
	const skin = $derived(resolveSkin(nodeData.componentId, design.provider));
	const replicas = $derived(nodeData.config.replicas ?? 1);
	const isSelected = $derived(selected || selection.nodeId === id);

	const metrics = $derived(sim.frame?.nodes.get(id) ?? null);

	const groupLags = $derived.by(() => {
		if (!sim.frame) return [];
		const out: { group: string; lag: number; lostRate: number }[] = [];
		for (const [key, g] of sim.frame.groups) {
			if (key.startsWith(`${id}/`))
				out.push({ group: key.slice(id.length + 1), lag: g.lag, lostRate: g.lostRate });
		}
		return out;
	});
	const isBottleneck = $derived(sim.frame?.totals.bottleneckNodeId === id);
	const statusRing = $derived.by(() => {
		if (!metrics) return '';
		if (metrics.health === 2) return 'ring-2 ring-rose-500 opacity-60';
		if (isBottleneck) return 'ring-2 ring-rose-500 animate-pulse';
		if (metrics.health === 1 || metrics.utilization > 0.8) return 'ring-2 ring-amber-500';
		if (metrics.utilization > 0.5) return 'ring-1 ring-amber-700';
		if (metrics.inRate > 0) return 'ring-1 ring-emerald-700';
		return '';
	});

	const CATEGORY_COLORS: Record<string, string> = {
		networking: 'border-l-sky-500',
		compute: 'border-l-violet-500',
		storage: 'border-l-amber-500',
		messaging: 'border-l-emerald-500',
		infrastructure: 'border-l-zinc-400'
	};

	function fmt(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
		if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
		return n.toFixed(0);
	}
</script>

<div
	class={[
		'min-w-36 rounded-lg border border-l-4 bg-zinc-900 px-3 py-2 shadow-md transition-colors',
		CATEGORY_COLORS[spec?.category ?? 'infrastructure'],
		isSelected ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-zinc-700',
		statusRing
	].join(' ')}
>
	<div class="flex items-center gap-2">
		<iconify-icon icon={skin.icon} width="26" height="26" class="shrink-0 text-zinc-200"
		></iconify-icon>
		<div class="min-w-0">
			<div class="truncate text-[15px] font-semibold text-zinc-100">{nodeData.label}</div>
			<div class="truncate text-[12.5px] text-zinc-400">{skin.name}</div>
		</div>
	</div>
	{#if replicas > 1 || nodeData.config.autoscale || metrics}
		<div class="mt-1 flex flex-wrap items-center gap-1.5">
			{#if metrics && Math.abs(metrics.replicas - replicas) > 0.01}
				<span
					class="rounded bg-cyan-950 px-1 py-px font-mono text-[12px] font-medium text-cyan-300"
					title="live replica count (autoscaling)"
				>
					×{metrics.replicas < 10
						? metrics.replicas.toFixed(1).replace('.0', '')
						: Math.round(metrics.replicas)}
				</span>
			{:else if replicas > 1}
				<span class="rounded bg-zinc-800 px-1 py-px text-[12px] font-medium text-zinc-300"
					>×{replicas}</span
				>
			{/if}
			{#if nodeData.config.autoscale}
				<span class="rounded bg-cyan-950 px-1 py-px text-[12px] font-medium text-cyan-300"
					>auto</span
				>
			{/if}
			{#if metrics}
				{#if metrics.health === 2}
					<span class="rounded bg-rose-950 px-1 py-px text-[12px] font-bold text-rose-300"
						>DEAD</span
					>
				{:else if metrics.inRate > 0}
					<span
						class={`rounded px-1 py-px font-mono text-[12px] ${
							metrics.utilization > 0.8
								? 'bg-rose-950 text-rose-300'
								: metrics.utilization > 0.5
									? 'bg-amber-950 text-amber-300'
									: 'bg-zinc-800 text-zinc-300'
						}`}
					>
						{(metrics.utilization * 100).toFixed(0)}%
					</span>
					<span class="rounded bg-zinc-800 px-1 py-px font-mono text-[12px] text-zinc-400">
						{fmt(metrics.inRate)}/s
					</span>
					{#if metrics.health === 1}
						<span class="rounded bg-amber-950 px-1 py-px text-[12px] font-bold text-amber-300"
							>DEGRADED</span
						>
					{/if}
				{/if}
				{#if metrics.queueDepth > 1}
					<span class="rounded bg-violet-950 px-1 py-px font-mono text-[12px] text-violet-300">
						q:{fmt(metrics.queueDepth)}
					</span>
				{/if}
				{#if metrics.retryInRate > 1}
					<span
						class="rounded bg-orange-950 px-1 py-px font-mono text-[12px] text-orange-300"
						title="retry traffic arriving on top of first attempts"
					>
						↻{fmt(metrics.retryInRate)}/s
					</span>
				{/if}
				{#if metrics.timeoutRate > 1}
					<span
						class="rounded bg-rose-950 px-1 py-px font-mono text-[12px] text-rose-300"
						title="requests timing out"
					>
						t/o {fmt(metrics.timeoutRate)}/s
					</span>
				{/if}
			{/if}
		</div>
	{/if}
	{#if groupLags.length > 0}
		<div class="mt-1 space-y-0.5">
			{#each groupLags as g (g.group)}
				<div class="flex items-center gap-1 font-mono text-[12px]">
					<span class="truncate text-zinc-500">{g.group}</span>
					<span
						class={`rounded px-1 ${g.lag > 1000 ? 'bg-rose-950 text-rose-300' : g.lag > 10 ? 'bg-amber-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}
					>
						lag {fmt(g.lag)}
					</span>
					{#if g.lostRate > 0}
						<span class="rounded bg-rose-950 px-1 text-rose-300">-{fmt(g.lostRate)}/s</span>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<Handle
		id="T"
		type="target"
		position={Position.Top}
		class="handle-in"
		title="IN - connections arrive here (top/left)"
	/>
	<Handle
		id="L"
		type="target"
		position={Position.Left}
		class="handle-in"
		title="IN - connections arrive here (top/left)"
	/>
	<Handle
		id="R"
		type="source"
		position={Position.Right}
		class="handle-out"
		title="OUT - drag from here to send traffic (right/bottom)"
	/>
	<Handle
		id="B"
		type="source"
		position={Position.Bottom}
		class="handle-out"
		title="OUT - drag from here to send traffic (right/bottom)"
	/>
</div>

<style>
	:global(.svelte-flow__handle.handle-in) {
		width: 13px;
		height: 13px;
		border-radius: 9999px;
		background: #241a15;
		border: 3px solid #a8b884;
	}
	:global(.svelte-flow__handle.handle-out) {
		width: 13px;
		height: 13px;
		border-radius: 3px;
		background: #d4a574;
		border: 2px solid #f0c080;
	}
	:global(.svelte-flow__handle.handle-in:hover),
	:global(.svelte-flow__handle.handle-out:hover) {
		transform: scale(1.35);
	}
</style>
