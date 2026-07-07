<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteFlowProvider } from '@xyflow/svelte';
	import TopBar from '$lib/components/layout/TopBar.svelte';
	import Palette from '$lib/components/palette/Palette.svelte';
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
	const selection = new SelectionStore();
	const sim = new SimulationStore();
	const ui = new UiStore();
	setEditorContext({ design, selection, sim, ui, readOnly: false });

	$effect.pre(() => {
		if (data.doc.id !== design.id) design.load(data.doc);
	});

	let lastStaleVersion = design.graphVersion;
	$effect(() => {
		const version = design.graphVersion;
		untrack(() => {
			if (version !== lastStaleVersion) {
				lastStaleVersion = version;
				sim.markStale();
			}
		});
	});

	$effect(() => () => sim.destroy());

	let canvas = $state<Canvas | null>(null);

	function isTyping(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		return (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			target.isContentEditable
		);
	}

	function onKeydown(event: KeyboardEvent) {
		if (isTyping(event.target)) return;
		const mod = event.metaKey || event.ctrlKey;
		if (mod && event.key.toLowerCase() === 'z') {
			event.preventDefault();
			if (event.shiftKey) design.redo();
			else design.undo();
		} else if (mod && event.key.toLowerCase() === 's') {
			event.preventDefault();
			void design.save();
		}
	}
</script>

<svelte:head>
	<title>{design.name || 'Design'} - ArchSim</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<div class="flex h-screen flex-col bg-zinc-950 text-zinc-100">
	<TopBar />
	<div class="flex min-h-0 flex-1">
		<SvelteFlowProvider>
			{#if ui.paletteOpen}
				<Palette onAdd={(componentId) => canvas?.addAtCenter(componentId)} />
			{/if}
			<button
				onclick={() => ui.togglePalette()}
				title={ui.paletteOpen ? 'Hide components' : 'Show components'}
				class="flex w-6 shrink-0 items-center justify-center border-r border-zinc-800 bg-zinc-900 text-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
			>
				{ui.paletteOpen ? '‹' : '›'}
			</button>
			<Canvas bind:this={canvas} />
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
