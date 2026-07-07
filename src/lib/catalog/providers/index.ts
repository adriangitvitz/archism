import type { Provider, ProviderMapping, ProviderSkin } from '../../types/provider';
import { getComponentById } from '../components';
import { AWS_MAPPING } from './aws';
import { GCP_MAPPING } from './gcp';
import { AZURE_MAPPING } from './azure';
import { BAREMETAL_MAPPING } from './baremetal';

const MAPPINGS: Partial<Record<Provider, ProviderMapping>> = {
	aws: AWS_MAPPING,
	gcp: GCP_MAPPING,
	azure: AZURE_MAPPING,
	baremetal: BAREMETAL_MAPPING
};

function lucideName(pascal: string): string {
	return `lucide:${pascal
		.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
		.replace(/([a-z])([0-9])/g, '$1-$2')
		.toLowerCase()}`;
}

export function resolveSkin(componentId: string, provider: Provider): ProviderSkin {
	const mapped = MAPPINGS[provider]?.[componentId];
	if (mapped) return mapped;
	const spec = getComponentById(componentId);
	return {
		componentId,
		name: spec?.label ?? componentId,
		icon: spec ? lucideName(spec.icon) : 'lucide:box'
	};
}

export function providerConstraints(provider: Provider): ProviderMapping {
	return MAPPINGS[provider] ?? {};
}
