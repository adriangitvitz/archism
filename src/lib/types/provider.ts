export type Provider = 'aws' | 'gcp' | 'azure' | 'baremetal' | 'generic';

export const PROVIDERS: { key: Provider; label: string }[] = [
	{ key: 'generic', label: 'Generic' },
	{ key: 'aws', label: 'AWS' },
	{ key: 'gcp', label: 'Google Cloud' },
	{ key: 'azure', label: 'Azure' },
	{ key: 'baremetal', label: 'Bare Metal' }
];

export type ConstraintCheck = 'maxQPS-cap' | 'requires-companion' | 'no-autoscale';

export interface ProviderConstraint {
	id: string;
	check: ConstraintCheck;
	params?: Record<string, unknown>;
	message: string;
	severity: 'warning' | 'error';
}

export interface ProviderSkin {
	componentId: string;
	name: string;
	icon: string;
	docsUrl?: string;
	constraints?: ProviderConstraint[];
	perfOverrides?: { maxQPS?: number; latencyMs?: number };
}

export type ProviderMapping = Record<string, ProviderSkin>;
