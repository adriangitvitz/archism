import type { ProviderMapping } from '../../types/provider';

export const GCP_MAPPING: ProviderMapping = {
	faas: {
		componentId: 'faas',
		name: 'Cloud Run functions',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/functions/docs'
	},
	'secrets-manager': {
		componentId: 'secrets-manager',
		name: 'Secret Manager',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/secret-manager/docs'
	},
	'event-bus': {
		componentId: 'event-bus',
		name: 'Eventarc',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/eventarc/docs'
	},
	'private-connectivity': {
		componentId: 'private-connectivity',
		name: 'Network Connectivity Center (+ Interconnect/VPN)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/network-connectivity/docs'
	},
	'ml-inference': {
		componentId: 'ml-inference',
		name: 'Vertex AI endpoints',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/vertex-ai/docs/predictions/overview'
	},
	'etl-pipeline': {
		componentId: 'etl-pipeline',
		name: 'Cloud Composer',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/composer/docs'
	},
	'distributed-sql': {
		componentId: 'distributed-sql',
		name: 'Cloud Spanner',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/spanner/docs'
	},
	'serverless-container': {
		componentId: 'serverless-container',
		name: 'Cloud Run',
		icon: 'logos:google-cloud-run',
		docsUrl: 'https://cloud.google.com/run/docs'
	},
	'durable-workflow': {
		componentId: 'durable-workflow',
		name: 'Workflows',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/workflows/docs'
	},
	'edge-delivery': {
		componentId: 'edge-delivery',
		name: 'Global Application Load Balancer (+ Cloud Armor/CDN)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/load-balancing/docs/application-load-balancer'
	},
	'static-hosting': {
		componentId: 'static-hosting',
		name: 'Firebase Hosting',
		icon: 'logos:firebase',
		docsUrl: 'https://firebase.google.com/docs/hosting'
	},
	firewall: {
		componentId: 'firewall',
		name: 'Cloud NGFW',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/firewall/docs'
	},
	dns: {
		componentId: 'dns',
		name: 'Cloud DNS',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/dns/docs'
	},
	cdn: {
		componentId: 'cdn',
		name: 'Cloud CDN',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/cdn/docs',
		constraints: [
			{
				id: 'gcp.cdn.requires-lb',
				check: 'requires-companion',
				params: { companionId: 'load-balancer' },
				message:
					'Cloud CDN only works behind a Google Cloud external Application Load Balancer - add a Load Balancer in front of your origins.',
				severity: 'error'
			}
		]
	},
	'load-balancer': {
		componentId: 'load-balancer',
		name: 'Cloud Load Balancing',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/load-balancing/docs'
	},
	'api-gateway': {
		componentId: 'api-gateway',
		name: 'Apigee',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/apigee/docs'
	},
	'rate-limiter': {
		componentId: 'rate-limiter',
		name: 'Cloud Armor (rate limiting)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/armor/docs/rate-limiting-overview',
		constraints: [
			{
				id: 'gcp.rate-limiter.requires-lb',
				check: 'requires-companion',
				params: { companionId: 'load-balancer' },
				message:
					'Cloud Armor policies attach to Cloud Load Balancing backend services - they cannot rate-limit traffic that bypasses the load balancer.',
				severity: 'error'
			}
		]
	},
	'app-server': {
		componentId: 'app-server',
		name: 'Compute Engine',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/compute/docs'
	},
	'auth-service': {
		componentId: 'auth-service',
		name: 'Identity Platform',
		icon: 'logos:firebase',
		docsUrl: 'https://cloud.google.com/identity-platform/docs'
	},
	'sql-db': {
		componentId: 'sql-db',
		name: 'Cloud SQL',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/sql/docs',
		constraints: [
			{
				id: 'gcp.sql-db.vertical-scaling',
				check: 'no-autoscale',
				message:
					'Cloud SQL scales vertically only (machine-type resize, with brief downtime) plus read replicas - no horizontal write autoscaling.',
				severity: 'warning'
			}
		]
	},
	'nosql-db': {
		componentId: 'nosql-db',
		name: 'Bigtable',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/bigtable/docs'
	},
	cache: {
		componentId: 'cache',
		name: 'Memorystore (Valkey/Redis)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/memorystore/docs'
	},
	'object-storage': {
		componentId: 'object-storage',
		name: 'Cloud Storage',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/storage/docs'
	},
	search: {
		componentId: 'search',
		name: 'Agent Search (formerly Vertex AI Search)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://docs.cloud.google.com/generative-ai-app-builder/docs'
	},
	'message-queue': {
		componentId: 'message-queue',
		name: 'Managed Service for Apache Kafka',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/managed-service-for-apache-kafka/docs/overview'
	},
	'service-mesh': {
		componentId: 'service-mesh',
		name: 'Cloud Service Mesh (Istio-based)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/service-mesh/docs'
	},
	monitoring: {
		componentId: 'monitoring',
		name: 'Cloud Monitoring',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/monitoring/docs'
	},
	'websocket-server': {
		componentId: 'websocket-server',
		name: 'Socket.io on GKE (self-managed)',
		icon: 'logos:socket-io',
		docsUrl: 'https://socket.io/docs/v4/'
	},
	'task-scheduler': {
		componentId: 'task-scheduler',
		name: 'Cloud Tasks (+ Cloud Scheduler for cron)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/tasks/docs'
	},
	'stream-processor': {
		componentId: 'stream-processor',
		name: 'Dataflow',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/dataflow/docs'
	},
	'notification-service': {
		componentId: 'notification-service',
		name: 'Firebase Cloud Messaging',
		icon: 'logos:firebase',
		docsUrl: 'https://firebase.google.com/docs/cloud-messaging'
	},
	'graph-db': {
		componentId: 'graph-db',
		name: 'Spanner Graph',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/spanner/docs/graph/overview'
	},
	'timeseries-db': {
		componentId: 'timeseries-db',
		name: 'InfluxDB on GCE (self-managed)',
		icon: 'logos:influxdb',
		docsUrl: 'https://docs.influxdata.com/'
	},
	'data-warehouse': {
		componentId: 'data-warehouse',
		name: 'BigQuery',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/bigquery/docs'
	},
	'service-discovery': {
		componentId: 'service-discovery',
		name: 'Service Directory',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/service-directory/docs'
	},
	'reverse-proxy': {
		componentId: 'reverse-proxy',
		name: 'Nginx on GCE (self-managed)',
		icon: 'logos:nginx',
		docsUrl: 'https://nginx.org/en/docs/'
	},
	'distributed-lock': {
		componentId: 'distributed-lock',
		name: 'etcd locks on GCE (self-managed)',
		icon: 'logos:etcd',
		docsUrl: 'https://etcd.io/docs/latest/dev-guide/api_concurrency_reference_v3/'
	},
	'circuit-breaker': {
		componentId: 'circuit-breaker',
		name: 'Resilience4j (in-app library)',
		icon: 'lucide:shield-off',
		docsUrl: 'https://resilience4j.readme.io/docs/circuitbreaker'
	},
	'file-store': {
		componentId: 'file-store',
		name: 'Filestore',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/filestore/docs'
	},
	'origin-shield': {
		componentId: 'origin-shield',
		name: 'Media CDN (origin shield tier)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/media-cdn/docs'
	},
	'coordination-service': {
		componentId: 'coordination-service',
		name: 'ZooKeeper on GCE (self-managed)',
		icon: 'lucide:users',
		docsUrl: 'https://zookeeper.apache.org/documentation.html'
	},
	'id-generator': {
		componentId: 'id-generator',
		name: 'Snowflake ID service on GKE (custom)',
		icon: 'lucide:fingerprint',
		docsUrl: 'https://cloud.google.com/kubernetes-engine/docs'
	},
	'sharded-counter': {
		componentId: 'sharded-counter',
		name: 'Firestore distributed counters',
		icon: 'logos:firebase',
		docsUrl: 'https://cloud.google.com/firestore/docs/solutions/counters'
	},
	'pub-sub': {
		componentId: 'pub-sub',
		name: 'Cloud Pub/Sub',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/pubsub/docs'
	},
	'vector-db': {
		componentId: 'vector-db',
		name: 'Vector Search (formerly Vertex AI Vector Search)',
		icon: 'logos:google-cloud',
		docsUrl:
			'https://docs.cloud.google.com/gemini-enterprise-agent-platform/build/vector-search/overview'
	},
	'geospatial-index': {
		componentId: 'geospatial-index',
		name: 'AlloyDB for PostgreSQL (PostGIS)',
		icon: 'logos:google-cloud',
		docsUrl: 'https://cloud.google.com/alloydb/docs/reference/extensions'
	},
	'config-service': {
		componentId: 'config-service',
		name: 'Firebase Remote Config',
		icon: 'logos:firebase',
		docsUrl: 'https://firebase.google.com/docs/remote-config'
	}
};
