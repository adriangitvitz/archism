import type { ProviderMapping } from '../../types/provider';

const NO_AUTOSCALE_MESSAGE =
	'Bare metal has no autoscaling - capacity must be provisioned manually ahead of peak load, with headroom for failure of individual machines.';

export const BAREMETAL_MAPPING: ProviderMapping = {
	faas: {
		componentId: 'faas',
		name: 'OpenFaaS',
		icon: 'lucide:zap',
		docsUrl: 'https://docs.openfaas.com/'
	},
	'secrets-manager': {
		componentId: 'secrets-manager',
		name: 'HashiCorp Vault',
		icon: 'simple-icons:vault',
		docsUrl: 'https://developer.hashicorp.com/vault/docs'
	},
	'event-bus': {
		componentId: 'event-bus',
		name: 'NATS JetStream',
		icon: 'lucide:route',
		docsUrl: 'https://docs.nats.io/nats-concepts/jetstream'
	},
	'private-connectivity': {
		componentId: 'private-connectivity',
		name: 'WireGuard hub',
		icon: 'simple-icons:wireguard',
		docsUrl: 'https://www.wireguard.com/'
	},
	'ml-inference': {
		componentId: 'ml-inference',
		name: 'vLLM (GPU nodes)',
		icon: 'lucide:brain',
		docsUrl: 'https://docs.vllm.ai/'
	},
	'etl-pipeline': {
		componentId: 'etl-pipeline',
		name: 'Apache Airflow + Spark',
		icon: 'simple-icons:apacheairflow',
		docsUrl: 'https://airflow.apache.org/docs/'
	},
	'distributed-sql': {
		componentId: 'distributed-sql',
		name: 'CockroachDB',
		icon: 'simple-icons:cockroachlabs',
		docsUrl: 'https://www.cockroachlabs.com/docs/'
	},
	'serverless-container': {
		componentId: 'serverless-container',
		name: 'Knative',
		icon: 'simple-icons:knative',
		docsUrl: 'https://knative.dev/docs/'
	},
	'durable-workflow': {
		componentId: 'durable-workflow',
		name: 'Temporal',
		icon: 'simple-icons:temporal',
		docsUrl: 'https://docs.temporal.io/'
	},
	'edge-delivery': {
		componentId: 'edge-delivery',
		name: 'Traefik + Coraza WAF (self-hosted edge)',
		icon: 'simple-icons:traefikproxy',
		docsUrl: 'https://doc.traefik.io/traefik/'
	},
	'static-hosting': {
		componentId: 'static-hosting',
		name: 'Caddy (static file server)',
		icon: 'simple-icons:caddy',
		docsUrl: 'https://caddyserver.com/docs/'
	},
	firewall: {
		componentId: 'firewall',
		name: 'OPNsense',
		icon: 'simple-icons:opnsense',
		docsUrl: 'https://docs.opnsense.org/'
	},
	dns: {
		componentId: 'dns',
		name: 'CoreDNS',
		icon: 'lucide:globe',
		docsUrl: 'https://coredns.io/manual/toc/'
	},
	cdn: {
		componentId: 'cdn',
		name: 'Varnish + GeoDNS (self-hosted)',
		icon: 'lucide:cloudy',
		docsUrl: 'https://varnish-cache.org/docs/'
	},
	'load-balancer': {
		componentId: 'load-balancer',
		name: 'HAProxy',
		icon: 'lucide:network',
		docsUrl: 'https://www.haproxy.org/#docs'
	},
	'api-gateway': {
		componentId: 'api-gateway',
		name: 'Kong',
		icon: 'logos:kong-icon',
		docsUrl: 'https://docs.konghq.com/gateway/latest/'
	},
	'rate-limiter': {
		componentId: 'rate-limiter',
		name: 'Envoy ratelimit service',
		icon: 'logos:envoy',
		docsUrl: 'https://github.com/envoyproxy/ratelimit'
	},
	'app-server': {
		componentId: 'app-server',
		name: 'Kubernetes',
		icon: 'logos:kubernetes',
		docsUrl: 'https://kubernetes.io/docs/',
		constraints: [
			{
				id: 'baremetal.app-server.no-autoscale',
				check: 'no-autoscale',
				message: NO_AUTOSCALE_MESSAGE,
				severity: 'error'
			}
		]
	},
	'auth-service': {
		componentId: 'auth-service',
		name: 'Keycloak',
		icon: 'simple-icons:keycloak',
		docsUrl: 'https://www.keycloak.org/documentation'
	},
	'sql-db': {
		componentId: 'sql-db',
		name: 'PostgreSQL',
		icon: 'logos:postgresql',
		docsUrl: 'https://www.postgresql.org/docs/',
		constraints: [
			{
				id: 'baremetal.sql-db.no-autoscale',
				check: 'no-autoscale',
				message: NO_AUTOSCALE_MESSAGE,
				severity: 'error'
			}
		]
	},
	'nosql-db': {
		componentId: 'nosql-db',

		name: 'Apache Cassandra',
		icon: 'logos:cassandra',
		docsUrl: 'https://cassandra.apache.org/doc/latest/'
	},
	cache: {
		componentId: 'cache',
		name: 'Redis',
		icon: 'logos:redis',
		docsUrl: 'https://redis.io/docs/latest/',
		constraints: [
			{
				id: 'baremetal.cache.no-autoscale',
				check: 'no-autoscale',
				message: NO_AUTOSCALE_MESSAGE,
				severity: 'error'
			}
		]
	},
	'object-storage': {
		componentId: 'object-storage',

		name: 'SeaweedFS (S3 API)',
		icon: 'lucide:archive',
		docsUrl: 'https://github.com/seaweedfs/seaweedfs/wiki'
	},
	search: {
		componentId: 'search',
		name: 'Elasticsearch',
		icon: 'logos:elasticsearch',
		docsUrl: 'https://www.elastic.co/guide/index.html'
	},
	'message-queue': {
		componentId: 'message-queue',
		name: 'RabbitMQ',
		icon: 'logos:rabbitmq',
		docsUrl: 'https://www.rabbitmq.com/docs'
	},
	'service-mesh': {
		componentId: 'service-mesh',
		name: 'Istio',
		icon: 'simple-icons:istio',
		docsUrl: 'https://istio.io/latest/docs/'
	},
	monitoring: {
		componentId: 'monitoring',
		name: 'Prometheus + Grafana',
		icon: 'logos:prometheus',
		docsUrl: 'https://prometheus.io/docs/'
	},
	'websocket-server': {
		componentId: 'websocket-server',
		name: 'Socket.io',
		icon: 'logos:socket-io',
		docsUrl: 'https://socket.io/docs/v4/',
		constraints: [
			{
				id: 'baremetal.websocket-server.no-autoscale',
				check: 'no-autoscale',
				message: NO_AUTOSCALE_MESSAGE,
				severity: 'error'
			}
		]
	},
	'task-scheduler': {
		componentId: 'task-scheduler',
		name: 'Dkron (distributed cron)',
		icon: 'lucide:clock',
		docsUrl: 'https://dkron.io/docs/basics/getting-started'
	},
	'stream-processor': {
		componentId: 'stream-processor',
		name: 'Apache Flink',
		icon: 'logos:apache-flink',
		docsUrl: 'https://nightlies.apache.org/flink/flink-docs-stable/'
	},
	'notification-service': {
		componentId: 'notification-service',
		name: 'Novu',
		icon: 'simple-icons:novu',
		docsUrl: 'https://docs.novu.co/'
	},
	'graph-db': {
		componentId: 'graph-db',
		name: 'Neo4j',
		icon: 'logos:neo4j',
		docsUrl: 'https://neo4j.com/docs/'
	},
	'timeseries-db': {
		componentId: 'timeseries-db',

		name: 'VictoriaMetrics',
		icon: 'simple-icons:victoriametrics',
		docsUrl: 'https://docs.victoriametrics.com/'
	},
	'data-warehouse': {
		componentId: 'data-warehouse',
		name: 'ClickHouse',
		icon: 'simple-icons:clickhouse',
		docsUrl: 'https://clickhouse.com/docs'
	},
	'service-discovery': {
		componentId: 'service-discovery',
		name: 'Consul',
		icon: 'logos:consul',
		docsUrl: 'https://developer.hashicorp.com/consul/docs'
	},
	'reverse-proxy': {
		componentId: 'reverse-proxy',
		name: 'Nginx',
		icon: 'logos:nginx',
		docsUrl: 'https://nginx.org/en/docs/'
	},
	'distributed-lock': {
		componentId: 'distributed-lock',

		name: 'etcd (lease-based locks)',
		icon: 'logos:etcd',
		docsUrl: 'https://etcd.io/docs/latest/dev-guide/api_concurrency_reference_v3/'
	},
	'circuit-breaker': {
		componentId: 'circuit-breaker',
		name: 'Resilience4j',
		icon: 'lucide:shield-off',
		docsUrl: 'https://resilience4j.readme.io/docs/circuitbreaker'
	},
	'file-store': {
		componentId: 'file-store',
		name: 'CephFS',
		icon: 'simple-icons:ceph',
		docsUrl: 'https://docs.ceph.com/en/latest/cephfs/'
	},
	'origin-shield': {
		componentId: 'origin-shield',
		name: 'Apache Traffic Server (shield tier)',
		icon: 'simple-icons:apache',
		docsUrl: 'https://docs.trafficserver.apache.org/'
	},
	'coordination-service': {
		componentId: 'coordination-service',
		name: 'ZooKeeper',
		icon: 'lucide:users',
		docsUrl: 'https://zookeeper.apache.org/documentation.html'
	},
	'id-generator': {
		componentId: 'id-generator',
		name: 'Snowflake implementation (custom)',
		icon: 'lucide:fingerprint',
		docsUrl: 'https://en.wikipedia.org/wiki/Snowflake_ID'
	},
	'sharded-counter': {
		componentId: 'sharded-counter',

		name: 'Valkey sharded counters (INCR)',
		icon: 'lucide:hash',
		docsUrl: 'https://valkey.io/topics/'
	},
	'pub-sub': {
		componentId: 'pub-sub',
		name: 'Kafka topics',
		icon: 'logos:kafka',
		docsUrl: 'https://kafka.apache.org/documentation/'
	},
	'vector-db': {
		componentId: 'vector-db',
		name: 'Qdrant',
		icon: 'logos:qdrant',
		docsUrl: 'https://qdrant.tech/documentation/'
	},
	'geospatial-index': {
		componentId: 'geospatial-index',
		name: 'PostGIS',
		icon: 'logos:postgresql',
		docsUrl: 'https://postgis.net/documentation/'
	},
	'config-service': {
		componentId: 'config-service',

		name: 'Unleash (feature flags)',
		icon: 'lucide:toggle-right',
		docsUrl: 'https://docs.getunleash.io/'
	}
};
