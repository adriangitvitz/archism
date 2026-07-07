<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import { docToGraph } from '$lib/engine/adapters';
	import { scoreDesign } from '$lib/scoring/scorer';

	const { design } = getEditorContext();

	const result = $derived.by(() => {
		void design.graphVersion;
		const { nodes, edges } = docToGraph(design.toDoc());
		return scoreDesign(nodes, edges);
	});
</script>

<div class="space-y-3 p-3">
	<div class="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-center">
		<div class="text-3xl font-bold text-zinc-100">
			{result.total}<span class="text-base text-zinc-500">/100</span>
		</div>
		<div class={`mt-1 text-sm font-semibold ${result.verdictColor}`}>{result.verdict}</div>
		<div class="mt-1 text-[13.5px] text-zinc-500">{result.summary}</div>
	</div>

	{#each result.categories as category (category.category)}
		<details class="rounded-lg border border-zinc-800 bg-zinc-900/60">
			<summary class="cursor-pointer px-3 py-2 text-xs text-zinc-200 select-none">
				<span class="font-semibold">{category.category}</span>
				<span class="float-right font-mono text-zinc-400">{category.score}/{category.maxScore}</span
				>
				<div class="mt-1.5 h-1 overflow-hidden rounded bg-zinc-800">
					<div
						class={`h-full ${category.score >= 15 ? 'bg-emerald-500' : category.score >= 8 ? 'bg-amber-500' : 'bg-rose-500'}`}
						style={`width:${(category.score / category.maxScore) * 100}%`}
					></div>
				</div>
			</summary>
			<div class="space-y-1.5 border-t border-zinc-800 p-2.5 text-[13.5px] leading-relaxed">
				{#each category.passed as p (p)}
					<p class="text-emerald-400/90">✓ {p}</p>
				{/each}
				{#each category.feedback as f (f)}
					<p class="text-zinc-400">→ {f}</p>
				{/each}
			</div>
		</details>
	{/each}
</div>
