import { getComponentById } from '$lib/catalog/components';

const ICON_BY_CATEGORY: Record<string, string> = {
	networking: 'internet',
	compute: 'server',
	storage: 'database',
	messaging: 'cloud',
	infrastructure: 'server'
};

const ICON_OVERRIDES: Record<string, string> = {
	'object-storage': 'disk',
	'file-store': 'disk',
	cdn: 'cloud',
	dns: 'internet'
};

export function mermaidIconFor(componentId: string): string {
	const override = ICON_OVERRIDES[componentId];
	if (override) return override;
	const spec = getComponentById(componentId);
	return spec ? (ICON_BY_CATEGORY[spec.category] ?? 'server') : 'server';
}

export function componentIdForIcon(icon: string): string {
	switch (icon) {
		case 'database':
			return 'sql-db';
		case 'disk':
			return 'object-storage';
		case 'internet':
			return 'dns';
		case 'cloud':
			return 'pub-sub';
		default:
			return 'app-server';
	}
}
