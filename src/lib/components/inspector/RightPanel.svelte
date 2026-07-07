<script lang="ts">
	import { untrack } from 'svelte';
	import Inspector from './Inspector.svelte';
	import ValidationPanel from '../validation/ValidationPanel.svelte';
	import ScorePanel from '../validation/ScorePanel.svelte';
	import TimelinePanel from '../sim/TimelinePanel.svelte';
	import { getEditorContext } from '$lib/stores/context';
	import { validateDesign } from '$lib/validation/validator';

	const { design, selection } = getEditorContext();

	let tab = $state<'inspect' | 'issues' | 'score' | 'timeline'>('inspect');

	$effect(() => {
		const selected = selection.nodeId || selection.edgeId;
		untrack(() => {
			if (selected && tab !== 'timeline') tab = 'inspect';
		});
	});

	const issueCount = $derived.by(() => {
		void design.graphVersion;
		return validateDesign(design.toDoc()).filter((i) => i.severity !== 'info').length;
	});
</script>

<aside class="flex h-full w-72 shrink-0 flex-col border-l border-zinc-800 bg-zinc-950/80">
	<div class="flex shrink-0 border-b border-zinc-800 text-xs">
		{#each [['inspect', 'Inspect'], ['issues', `Issues${issueCount > 0 ? ` (${issueCount})` : ''}`], ['score', 'Score'], ['timeline', 'Timeline']] as [key, label] (key)}
			<button
				onclick={() => (tab = key as typeof tab)}
				class={`flex-1 px-2 py-2 ${tab === key ? 'border-b-2 border-cyan-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
			>
				{label}
			</button>
		{/each}
	</div>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{#if tab === 'inspect'}
			<Inspector />
		{:else if tab === 'issues'}
			<ValidationPanel />
		{:else if tab === 'score'}
			<ScorePanel />
		{:else}
			<TimelinePanel />
		{/if}
	</div>
</aside>
