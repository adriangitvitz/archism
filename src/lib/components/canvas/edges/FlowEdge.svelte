<script lang="ts">
	import { BaseEdge, EdgeLabel, getBezierPath, type EdgeProps } from '@xyflow/svelte';
	import type { FlowEdgeData } from '$lib/stores/design.svelte';
	import { getEditorContext } from '$lib/stores/context';

	let {
		id,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		data,
		selected
	}: EdgeProps = $props();

	const { sim } = getEditorContext();

	const edgeData = $derived((data ?? { kind: 'sync' }) as FlowEdgeData);
	const flow = $derived(sim.frame?.edgeFlow.get(id) ?? null);
	const active = $derived((flow?.flowRate ?? 0) > 0.5);
	const linkState = $derived(flow?.linkState ?? 0);

	const path = $derived(
		getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
	);

	const stroke = $derived.by(() => {
		if (linkState === 3) return '#8b7355';
		if (linkState === 1) return '#e89070';
		if (linkState === 2) return '#e8b55e';
		if (flow?.saturated) return '#e89070';
		if (selected) return '#f0c080';
		if (edgeData.kind === 'pubsub') return '#d9988a';
		if (edgeData.kind === 'async') return '#a8b884';
		return active ? '#d4a574' : '#8b7355';
	});

	const width = $derived(
		active ? Math.min(4, 1.5 + Math.log10(1 + (flow?.flowRate ?? 0)) * 0.5) : 1.5
	);
	const dashDur = $derived(
		active ? Math.max(0.15, 1.6 - Math.log10(1 + (flow?.flowRate ?? 0)) * 0.25) : 0
	);
	const dash = $derived(active ? '8 8' : edgeData.kind === 'sync' ? undefined : '6 4');
	const badge = $derived.by(() => {
		if (active)
			return `${flow!.flowRate >= 1000 ? `${(flow!.flowRate / 1000).toFixed(1)}k` : flow!.flowRate.toFixed(0)}/s`;
		return (
			edgeData.label ?? edgeData.protocol ?? (edgeData.kind !== 'sync' ? edgeData.kind : undefined)
		);
	});
</script>

<BaseEdge
	path={path[0]}
	style={`stroke:${stroke};stroke-width:${width};${dash ? `stroke-dasharray:${dash};` : ''}${
		active ? `animation: archsim-flow ${dashDur}s linear infinite;` : ''
	}`}
/>
{#if badge}
	<EdgeLabel x={path[1]} y={path[2]}>
		<div
			class={`rounded px-1.5 py-0.5 font-mono text-[12px] ${
				flow?.saturated
					? 'bg-rose-950 text-rose-300'
					: active
						? 'bg-zinc-800/90 text-cyan-300'
						: 'bg-zinc-800/90 text-zinc-400'
			}`}
		>
			{badge}
		</div>
	</EdgeLabel>
{/if}

<style>
	:global {
		@keyframes archsim-flow {
			to {
				stroke-dashoffset: -16;
			}
		}
	}
</style>
