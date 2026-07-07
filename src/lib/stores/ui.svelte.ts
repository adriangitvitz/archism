export class UiStore {
	mermaidOpen = $state(false);
	paletteOpen = $state(true);
	rightOpen = $state(true);

	togglePalette(): void {
		this.paletteOpen = !this.paletteOpen;
	}

	toggleRight(): void {
		this.rightOpen = !this.rightOpen;
	}

	toggleMermaid(): void {
		this.mermaidOpen = !this.mermaidOpen;
	}
}
