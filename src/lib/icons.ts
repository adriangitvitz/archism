import { addCollection, type IconifyJSON } from 'iconify-icon';
import bundle from '$lib/catalog/icon-bundle.json';

let registered = false;

export function registerIcons(): void {
	if (registered) return;
	registered = true;
	for (const collection of bundle as unknown as IconifyJSON[]) {
		addCollection(collection);
	}
}
