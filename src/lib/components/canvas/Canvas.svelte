<script lang="ts">
	import { Background, Controls, Panel, SvelteFlow, useSvelteFlow } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import ComponentNode from './nodes/ComponentNode.svelte';
	import FlowEdge from './edges/FlowEdge.svelte';
	import { getEditorContext } from '$lib/stores/context';

	const { design, selection, readOnly } = getEditorContext();
	const { screenToFlowPosition } = useSvelteFlow();

	const nodeTypes = { component: ComponentNode };
	const edgeTypes = { flow: FlowEdge };

	function onDrop(event: DragEvent) {
		if (readOnly) return;
		const componentId = event.dataTransfer?.getData('application/archsim-component');
		if (!componentId) return;
		event.preventDefault();
		const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
		design.addNode(componentId, position);
	}

	function onDragOver(event: DragEvent) {
		if (readOnly) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	export function addAtCenter(componentId: string) {
		if (readOnly) return;
		const position = screenToFlowPosition({
			x: window.innerWidth / 2,
			y: window.innerHeight / 2
		});
		design.addNode(componentId, position);
	}
</script>

<div class="h-full flex-1" role="application" ondrop={onDrop} ondragover={onDragOver}>
	<SvelteFlow
		bind:nodes={design.nodes}
		bind:edges={design.edges}
		{nodeTypes}
		{edgeTypes}
		fitView
		proOptions={{ hideAttribution: true }}
		nodesDraggable={!readOnly}
		nodesConnectable={!readOnly}
		elementsSelectable
		deleteKey={readOnly ? null : ['Backspace', 'Delete']}
		colorMode="dark"
		onbeforeconnect={(connection) => {
			design.beginGesture();
			return design.createEdge(
				connection.source,
				connection.target,
				connection.sourceHandle,
				connection.targetHandle
			);
		}}
		onconnect={() => design.markDirty()}
		ondelete={() => {
			selection.clear();
			design.markDirty();
		}}
		onnodedragstart={() => design.beginGesture()}
		onnodedragstop={() => design.markDirty(false)}
		onnodeclick={({ node }) => selection.selectNode(node.id)}
		onedgeclick={({ edge }) => selection.selectEdge(edge.id)}
		onpaneclick={() => selection.clear()}
	>
		<Background bgColor="#241a15" patternColor="#3d2817" />
		<Panel position="top-left">
			<div
				class="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-1.5 text-[13px] text-zinc-300"
			>
				<span class="flex items-center gap-1.5">
					<span
						class="inline-block h-3 w-3 rounded-full border-[3px] border-[#a8b884] bg-transparent"
					></span>
					in <span class="text-zinc-500">(top/left)</span>
				</span>
				<span class="flex items-center gap-1.5">
					<span class="inline-block h-3 w-3 rounded-[3px] border border-[#f0c080] bg-[#d4a574]"
					></span>
					out <span class="text-zinc-500">(right/bottom)</span>
				</span>
				<span class="text-zinc-500">- drag out → in</span>
			</div>
		</Panel>
		<Controls />
	</SvelteFlow>
</div>
