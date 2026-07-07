<script lang="ts">
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Canvas from '$lib/components/canvas/Canvas.svelte';
	import RightPanel from '$lib/components/inspector/RightPanel.svelte';
	import SimControlBar from '$lib/components/sim/SimControlBar.svelte';
	import MermaidPanel from '$lib/components/mermaid/MermaidPanel.svelte';
	import { DesignStore } from '$lib/stores/design.svelte';
	import { SelectionStore } from '$lib/stores/selection.svelte';
	import { SimulationStore } from '$lib/stores/simulation.svelte';
	import { UiStore } from '$lib/stores/ui.svelte';
	import { setEditorContext } from '$lib/stores/context';
	import { registerIcons } from '$lib/icons';

	let { data } = $props();

	registerIcons();

	const design = new DesignStore();
	design.readOnly = true;
	const selection = new SelectionStore();
	const sim = new SimulationStore();
	const ui = new UiStore();
	setEditorContext({ design, selection, sim, ui, readOnly: true });

	$effect.pre(() => {
		if (data.doc.id !== design.id) design.load(data.doc);
	});

	$effect(() => () => sim.destroy());
</script>

<svelte:head>
	<title>{design.name || 'Shared design'} - ArchSim</title>
</svelte:head>

<div class="flex h-screen flex-col bg-zinc-950 text-zinc-100">
	<TopBar />
	<div
		class="border-b border-amber-900/50 bg-amber-950/30 px-3 py-1 text-center text-[13.5px] text-amber-300"
	>
		Read-only shared design - you can run simulations, but edits aren't saved.
	</div>
	<div class="flex min-h-0 flex-1">
		<SvelteFlowProvider>
			<Canvas />
		</SvelteFlowProvider>
		<button
			onclick={() => ui.toggleRight()}
			title={ui.rightOpen ? 'Hide panel' : 'Show panel'}
			class="flex w-6 shrink-0 items-center justify-center border-l border-zinc-800 bg-zinc-900 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
		>
			{ui.rightOpen ? '›' : '‹'}
		</button>
		{#if ui.rightOpen}
			<RightPanel />
		{/if}
	</div>
	{#if ui.mermaidOpen}
		<MermaidPanel />
	{/if}
	<SimControlBar />
</div>
