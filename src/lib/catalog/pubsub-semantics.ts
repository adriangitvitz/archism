import type { Provider } from '../types/provider';

export interface PubSubSemantics {
	product: string;

	partitionsCapParallelism: boolean;

	canBackpressurePublishers: boolean;

	note: string;
}

const GENERIC: PubSubSemantics = {
	product: 'generic topic',
	partitionsCapParallelism: true,
	canBackpressurePublishers: true,
	note: 'Kafka-style log semantics: partitions cap consumer parallelism; retention overflow can backpressure publishers or drop oldest.'
};

const SEMANTICS: Record<Provider, PubSubSemantics> = {
	generic: GENERIC,
	aws: {
		product: 'Amazon SNS',
		partitionsCapParallelism: false,
		canBackpressurePublishers: false,
		note: 'SNS fan-out: no partitions and no consumer-parallelism cap; publishers are never throttled by consumer lag - only by hard account/topic publish quotas (push delivery, no retention).'
	},
	gcp: {
		product: 'Cloud Pub/Sub',
		partitionsCapParallelism: false,
		canBackpressurePublishers: false,
		note: 'Cloud Pub/Sub: subscribers autoscale, so throughput is not capped by a partition count; publishers are never backpressured by consumer lag, unacked messages retained (default 7 days).'
	},
	azure: {
		product: 'Azure Event Hubs',
		partitionsCapParallelism: true,
		canBackpressurePublishers: true,
		note: 'Event Hubs: partition-based (Kafka-like); consumer parallelism is capped by partition count; throughput units throttle publishers when exceeded.'
	},
	baremetal: {
		product: 'Apache Kafka',
		partitionsCapParallelism: true,
		canBackpressurePublishers: true,
		note: 'Kafka: partition count caps consumer-group parallelism; retention overflow drops oldest by default (or slows producers via quotas).'
	}
};

export function pubSubSemantics(provider: Provider): PubSubSemantics {
	return SEMANTICS[provider] ?? GENERIC;
}
