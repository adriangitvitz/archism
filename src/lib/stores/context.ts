import { getContext, setContext } from 'svelte';
import type { DesignStore } from './design.svelte';
import type { SelectionStore } from './selection.svelte';
import type { SimulationStore } from './simulation.svelte';
import type { UiStore } from './ui.svelte';

export interface EditorContext {
	design: DesignStore;
	selection: SelectionStore;
	sim: SimulationStore;
	ui: UiStore;
	readOnly: boolean;
}

const KEY = Symbol('archsim-editor');

export function setEditorContext(ctx: EditorContext): void {
	setContext(KEY, ctx);
}

export function getEditorContext(): EditorContext {
	const ctx = getContext<EditorContext | undefined>(KEY);
	if (!ctx) throw new Error('editor context missing - component used outside the editor tree');
	return ctx;
}
