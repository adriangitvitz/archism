<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import { validateDesign } from '$lib/validation/validator';

	const { design, selection } = getEditorContext();

	const issues = $derived.by(() => {
		void design.graphVersion;
		return validateDesign(design.toDoc());
	});

	const SEVERITY_STYLES = {
		error: 'border-rose-900 bg-rose-950/40 text-rose-300',
		warning: 'border-amber-900 bg-amber-950/40 text-amber-300',
		info: 'border-zinc-700 bg-zinc-900 text-zinc-400'
	} as const;
	const SEVERITY_ICONS = { error: '✕', warning: '⚠', info: 'ℹ' } as const;
</script>

<div class="space-y-2 p-3">
	{#if issues.length === 0}
		<div
			class="rounded-lg border border-emerald-900 bg-emerald-950/30 p-3 text-xs text-emerald-300"
		>
			✓ No issues - the design passes all static checks for this provider.
		</div>
	{:else}
		<p class="text-[13.5px] text-zinc-500">
			{issues.filter((i) => i.severity === 'error').length} errors ·
			{issues.filter((i) => i.severity === 'warning').length} warnings ·
			{issues.filter((i) => i.severity === 'info').length} hints
		</p>
		{#each issues as issue, idx (issue.ruleId + idx)}
			<button
				onclick={() => issue.nodeIds[0] && selection.selectNode(issue.nodeIds[0])}
				class={`block w-full rounded-lg border p-2.5 text-left text-[13.5px] leading-relaxed transition hover:brightness-125 ${SEVERITY_STYLES[issue.severity]}`}
			>
				<span class="mr-1 font-bold">{SEVERITY_ICONS[issue.severity]}</span>
				{issue.message}
				<span class="mt-1 block font-mono text-[12px] opacity-60">
					{issue.ruleId}{issue.provider ? ` · ${issue.provider}` : ''}
				</span>
			</button>
		{/each}
	{/if}
</div>
