<script lang="ts">
	import { getEditorContext } from '$lib/stores/context';
	import { serializeDoc } from '$lib/mermaid/serialize';
	import { parseMermaid, type ParseError } from '$lib/mermaid/parse';

	const { design, readOnly } = getEditorContext();

	let text = $state('');
	let dirty = $state(false);
	let errors = $state<ParseError[]>([]);
	let warnings = $state<string[]>([]);
	let copied = $state(false);

	$effect(() => {
		void design.graphVersion;
		void design.provider;
		void design.name;
		if (!dirty) {
			text = serializeDoc(design.toDoc());
			errors = [];
			warnings = [];
		}
	});

	function onInput(value: string) {
		text = value;
		dirty = true;

		const result = parseMermaid(value);
		errors = result.errors;
		warnings = result.warnings;
	}

	function apply() {
		const result = parseMermaid(text);
		errors = result.errors;
		warnings = result.warnings;
		if (result.errors.length > 0 || !result.doc) return;
		const current = design.toDoc();
		design.load({
			...result.doc,
			id: current.id,

			name: result.doc.name === 'Imported design' ? current.name : result.doc.name,
			provider: result.doc.provider === 'generic' ? current.provider : result.doc.provider,
			meta: current.meta
		});
		design.markDirty();
		dirty = false;
	}

	function revert() {
		dirty = false;
		text = serializeDoc(design.toDoc());
		errors = [];
		warnings = [];
	}

	async function copy() {
		await navigator.clipboard.writeText(text).catch(() => {});
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<div class="flex h-64 shrink-0 flex-col border-t border-zinc-800 bg-zinc-950">
	<div class="flex items-center gap-2 border-b border-zinc-800/60 px-3 py-1.5 text-xs">
		<span class="font-semibold text-zinc-300">Mermaid</span>
		<span class="text-[12.5px] text-zinc-600">architecture-beta · edits sync both ways</span>
		<div class="flex-1"></div>
		{#if dirty && !readOnly}
			<button
				onclick={apply}
				disabled={errors.length > 0}
				class="rounded bg-cyan-600 px-2.5 py-1 font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
			>
				Apply to canvas
			</button>
			<button
				onclick={revert}
				class="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
			>
				Revert
			</button>
		{/if}
		<button
			onclick={copy}
			class="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500"
		>
			{copied ? 'Copied!' : 'Copy'}
		</button>
	</div>
	<div class="flex min-h-0 flex-1">
		<textarea
			value={text}
			oninput={(e) => onInput(e.currentTarget.value)}
			readonly={readOnly}
			spellcheck="false"
			class="min-h-0 flex-1 resize-none bg-zinc-950 p-3 font-mono text-[13.5px] leading-relaxed text-zinc-300 focus:outline-none"
		></textarea>
		{#if errors.length > 0 || warnings.length > 0}
			<div class="w-72 shrink-0 overflow-y-auto border-l border-zinc-800 p-2 text-[13.5px]">
				{#each errors as err (err.line + err.message)}
					<p class="mb-1 text-rose-400">L{err.line}: {err.message}</p>
				{/each}
				{#each warnings as warning (warning)}
					<p class="mb-1 text-amber-400">{warning}</p>
				{/each}
			</div>
		{/if}
	</div>
</div>
