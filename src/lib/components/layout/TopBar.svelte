<script lang="ts">
	import { resolve } from '$app/paths';
	import { PROVIDERS, type Provider } from '$lib/types/provider';
	import { getEditorContext } from '$lib/stores/context';
	import { PRESETS, presetToDoc } from '$lib/catalog/presets';

	const { design, sim, ui, readOnly } = getEditorContext();

	function loadPreset(presetId: string) {
		const preset = PRESETS.find((p) => p.id === presetId);
		if (!preset) return;
		if (design.nodes.length > 0 && !confirm(`Replace the current canvas with "${preset.name}"?`))
			return;
		const current = design.toDoc();
		design.load(presetToDoc(preset, current.id, current.meta));
		design.markDirty();
		sim.setRps(preset.rps);
		alert(`${preset.name}\n\n${preset.howTo}`);
	}

	let shareUrl = $state<string | null>(null);
	let shareBusy = $state(false);

	async function share() {
		shareBusy = true;
		try {
			const res = await fetch(`/api/designs/${design.id}/share`, { method: 'POST' });
			if (res.ok) {
				const { url } = (await res.json()) as { url: string };
				shareUrl = new URL(url, location.origin).href;
				await navigator.clipboard.writeText(shareUrl).catch(() => {});
			}
		} finally {
			shareBusy = false;
		}
	}

	const SAVE_LABELS: Record<string, string> = {
		saved: 'Saved',
		dirty: 'Unsaved changes…',
		saving: 'Saving…',
		error: 'Save failed - retrying on next change'
	};
</script>

<header class="flex h-12 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-3">
	<a href={resolve('/')} class="text-sm font-bold tracking-tight text-zinc-100 hover:text-cyan-400"
		>ArchSim</a
	>
	<div class="h-5 w-px bg-zinc-800"></div>

	<input
		value={design.name}
		oninput={(e) => design.rename(e.currentTarget.value)}
		disabled={readOnly}
		class="w-56 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-zinc-100 hover:border-zinc-700 focus:border-cyan-500 focus:outline-none disabled:hover:border-transparent"
	/>

	<select
		value={design.provider}
		onchange={(e) => design.setProvider(e.currentTarget.value as Provider)}
		disabled={readOnly}
		class="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500 focus:outline-none"
	>
		{#each PROVIDERS as p (p.key)}
			<option value={p.key}>{p.label}</option>
		{/each}
	</select>

	<div class="flex-1"></div>

	{#if design.conflictWarning}
		<span
			class="text-xs text-amber-400"
			title="Another tab saved this design; your version overwrote it."
		>
			⚠ concurrent edit
		</span>
	{/if}
	{#if !readOnly}
		<select
			value=""
			onchange={(e) => {
				loadPreset(e.currentTarget.value);
				e.currentTarget.value = '';
			}}
			class="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-400 focus:border-cyan-500 focus:outline-none"
		>
			<option value="" disabled>Preset scenario…</option>
			{#each PRESETS as preset (preset.id)}
				<option value={preset.id} title={preset.description}>{preset.name}</option>
			{/each}
		</select>
	{/if}
	<button
		onclick={() => ui.toggleMermaid()}
		class={`rounded-md border px-2.5 py-1 text-xs ${ui.mermaidOpen ? 'border-cyan-600 text-cyan-300' : 'border-zinc-700 text-zinc-200 hover:border-zinc-500'}`}
	>
		Mermaid
	</button>
	{#if !readOnly}
		<span
			class={`text-xs ${design.saveState === 'error' ? 'text-rose-400' : design.saveState === 'saved' ? 'text-zinc-500' : 'text-zinc-400'}`}
		>
			{SAVE_LABELS[design.saveState]}
		</span>
		<button
			onclick={share}
			disabled={shareBusy}
			class="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-200 hover:border-zinc-500 disabled:opacity-50"
		>
			{shareUrl ? 'Link copied!' : shareBusy ? 'Sharing…' : 'Share'}
		</button>
	{/if}
</header>
