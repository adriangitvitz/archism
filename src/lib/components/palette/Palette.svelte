<script lang="ts">
	import { COMPONENT_CATEGORIES, SYSTEM_COMPONENTS } from '$lib/catalog/components';
	import { resolveSkin } from '$lib/catalog/providers';
	import { getEditorContext } from '$lib/stores/context';
	import 'iconify-icon';

	let { onAdd }: { onAdd: (componentId: string) => void } = $props();

	const { design } = getEditorContext();

	let search = $state('');

	const filtered = $derived(
		SYSTEM_COMPONENTS.filter((c) => {
			if (!search.trim()) return true;
			const q = search.toLowerCase();
			const skin = resolveSkin(c.id, design.provider);
			return c.label.toLowerCase().includes(q) || skin.name.toLowerCase().includes(q);
		})
	);

	function onDragStart(event: DragEvent, componentId: string) {
		event.dataTransfer?.setData('application/archsim-component', componentId);
		event.dataTransfer!.effectAllowed = 'copy';
	}
</script>

<aside class="flex h-full w-60 flex-col border-r border-zinc-800 bg-zinc-925 bg-zinc-950/80">
	<div class="border-b border-zinc-800 p-3">
		<input
			bind:value={search}
			placeholder="Search components…"
			class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs placeholder-zinc-500 focus:border-cyan-500 focus:outline-none"
		/>
	</div>
	<div class="flex-1 overflow-y-auto p-2">
		{#each COMPONENT_CATEGORIES as category (category.key)}
			{@const items = filtered.filter((c) => c.category === category.key)}
			{#if items.length > 0}
				<div
					class="mt-2 mb-1 px-1 text-[12.5px] font-semibold tracking-wider text-zinc-500 uppercase first:mt-0"
				>
					{category.label}
				</div>
				{#each items as component (component.id)}
					{@const skin = resolveSkin(component.id, design.provider)}
					<button
						draggable="true"
						ondragstart={(e) => onDragStart(e, component.id)}
						ondblclick={() => onAdd(component.id)}
						title={`${component.description.slice(0, 140)}… (drag to canvas, or double-click to add)`}
						class="flex w-full cursor-grab items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-zinc-800/70 active:cursor-grabbing"
					>
						<iconify-icon icon={skin.icon} width="18" height="18" class="shrink-0 text-zinc-300"
						></iconify-icon>
						<span class="min-w-0">
							<span class="block truncate text-xs text-zinc-200">{component.label}</span>
							{#if skin.name !== component.label}
								<span class="block truncate text-[12.5px] text-zinc-500">{skin.name}</span>
							{/if}
						</span>
					</button>
				{/each}
			{/if}
		{/each}
	</div>
</aside>
