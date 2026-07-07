import type { ProviderMapping } from '../../types/provider';

export const AZURE_MAPPING: ProviderMapping = {
	faas: {
		componentId: 'faas',
		name: 'Azure Functions (Flex Consumption)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-functions/'
	},
	'secrets-manager': {
		componentId: 'secrets-manager',
		name: 'Azure Key Vault',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/key-vault/'
	},
	'event-bus': {
		componentId: 'event-bus',
		name: 'Azure Event Grid',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/event-grid/'
	},
	'private-connectivity': {
		componentId: 'private-connectivity',
		name: 'Azure VPN Gateway / ExpressRoute',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/vpn-gateway/'
	},
	'ml-inference': {
		componentId: 'ml-inference',
		name: 'Azure OpenAI (Foundry)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/'
	},
	'etl-pipeline': {
		componentId: 'etl-pipeline',
		name: 'Azure Data Factory',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/data-factory/'
	},
	'distributed-sql': {
		componentId: 'distributed-sql',
		name: 'Cosmos DB for PostgreSQL (Citus)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/cosmos-db/postgresql/'
	},
	'serverless-container': {
		componentId: 'serverless-container',
		name: 'Azure Container Apps',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/container-apps/'
	},
	'durable-workflow': {
		componentId: 'durable-workflow',
		name: 'Azure Logic Apps',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/logic-apps/'
	},
	'edge-delivery': {
		componentId: 'edge-delivery',
		name: 'Azure Front Door Premium',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/frontdoor/'
	},
	'static-hosting': {
		componentId: 'static-hosting',
		name: 'Azure Static Web Apps',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/static-web-apps/'
	},
	firewall: {
		componentId: 'firewall',
		name: 'Azure Firewall (Premium)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/firewall/'
	},
	dns: {
		componentId: 'dns',
		name: 'Azure DNS',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/dns/'
	},
	cdn: {
		componentId: 'cdn',
		name: 'Azure Front Door Standard (caching tier)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/frontdoor/front-door-cdn-comparison'
	},
	'load-balancer': {
		componentId: 'load-balancer',
		name: 'Azure Application Gateway',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/application-gateway/'
	},
	'api-gateway': {
		componentId: 'api-gateway',
		name: 'API Management',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/api-management/',
		constraints: [
			{
				id: 'azure.api-gateway.tier-cap',
				check: 'maxQPS-cap',
				params: { cap: 4000 },
				message:
					'API Management throughput is capped per tier/unit (roughly 1,000 RPS on Basic up to ~4,000 RPS per Premium unit). Add scale units for higher throughput.',
				severity: 'warning'
			}
		]
	},
	'rate-limiter': {
		componentId: 'rate-limiter',
		name: 'API Management rate-limit policies',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/api-management/rate-limit-policy',
		constraints: [
			{
				id: 'azure.rate-limiter.requires-apim',
				check: 'requires-companion',
				params: { companionId: 'api-gateway' },
				message:
					'On Azure, rate limiting is typically an API Management policy (rate-limit / rate-limit-by-key) - pair this with an API Management gateway.',
				severity: 'warning'
			}
		]
	},
	'app-server': {
		componentId: 'app-server',
		name: 'App Service',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/app-service/'
	},
	'auth-service': {
		componentId: 'auth-service',
		name: 'Microsoft Entra External ID',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/entra/external-id/'
	},
	'sql-db': {
		componentId: 'sql-db',
		name: 'Azure SQL Database',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-sql/'
	},
	'nosql-db': {
		componentId: 'nosql-db',
		name: 'Cosmos DB for NoSQL',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/cosmos-db/nosql/'
	},
	cache: {
		componentId: 'cache',
		name: 'Azure Managed Redis',
		icon: 'logos:redis',
		docsUrl: 'https://learn.microsoft.com/azure/redis/',
		constraints: [
			{
				id: 'azure.cache.manual-scale',
				check: 'no-autoscale',
				message:
					'Azure Managed Redis has no autoscale - moving to a larger SKU or resizing the cluster is a manual scaling operation.',
				severity: 'warning'
			}
		]
	},
	'object-storage': {
		componentId: 'object-storage',
		name: 'Blob Storage',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/storage/blobs/'
	},
	search: {
		componentId: 'search',
		name: 'Azure AI Search',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/search/'
	},
	'message-queue': {
		componentId: 'message-queue',
		name: 'Service Bus',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/service-bus-messaging/'
	},
	'service-mesh': {
		componentId: 'service-mesh',
		name: 'Istio add-on for AKS',
		icon: 'simple-icons:istio',
		docsUrl: 'https://learn.microsoft.com/azure/aks/istio-about'
	},
	monitoring: {
		componentId: 'monitoring',
		name: 'Azure Monitor (Application Insights)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-monitor/'
	},
	'websocket-server': {
		componentId: 'websocket-server',
		name: 'Azure Web PubSub',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-web-pubsub/'
	},
	'task-scheduler': {
		componentId: 'task-scheduler',
		name: 'Azure Functions (Timer trigger)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-functions/functions-bindings-timer'
	},
	'stream-processor': {
		componentId: 'stream-processor',
		name: 'Stream Analytics',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/stream-analytics/'
	},
	'notification-service': {
		componentId: 'notification-service',
		name: 'Azure Communication Services',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/communication-services/'
	},
	'graph-db': {
		componentId: 'graph-db',
		name: 'Cosmos DB for Apache Gremlin',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/cosmos-db/gremlin/'
	},
	'timeseries-db': {
		componentId: 'timeseries-db',
		name: 'Azure Data Explorer (Kusto)',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/data-explorer/'
	},
	'data-warehouse': {
		componentId: 'data-warehouse',
		name: 'Microsoft Fabric Warehouse',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/fabric/data-warehouse/'
	},
	'service-discovery': {
		componentId: 'service-discovery',
		name: 'Consul on AKS (self-managed)',
		icon: 'logos:consul',
		docsUrl: 'https://developer.hashicorp.com/consul/docs'
	},
	'reverse-proxy': {
		componentId: 'reverse-proxy',
		name: 'Nginx on Azure VMs (self-managed)',
		icon: 'logos:nginx',
		docsUrl: 'https://nginx.org/en/docs/'
	},
	'distributed-lock': {
		componentId: 'distributed-lock',
		name: 'etcd locks on VMs (self-managed)',
		icon: 'logos:etcd',
		docsUrl: 'https://etcd.io/docs/latest/dev-guide/api_concurrency_reference_v3/'
	},
	'circuit-breaker': {
		componentId: 'circuit-breaker',
		name: 'Polly (.NET library)',
		icon: 'lucide:shield-off',
		docsUrl:
			'https://learn.microsoft.com/dotnet/architecture/microservices/implement-resilient-applications/implement-circuit-breaker-pattern'
	},
	'file-store': {
		componentId: 'file-store',
		name: 'Azure Files',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/storage/files/'
	},
	'origin-shield': {
		componentId: 'origin-shield',
		name: 'Varnish on VMs (origin shield tier)',
		icon: 'lucide:shield-check',
		docsUrl: 'https://varnish-cache.org/docs/'
	},
	'coordination-service': {
		componentId: 'coordination-service',
		name: 'ZooKeeper on VMs (self-managed)',
		icon: 'lucide:users',
		docsUrl: 'https://zookeeper.apache.org/documentation.html'
	},
	'id-generator': {
		componentId: 'id-generator',
		name: 'Snowflake ID service on AKS (custom)',
		icon: 'lucide:fingerprint',
		docsUrl: 'https://learn.microsoft.com/azure/aks/'
	},
	'sharded-counter': {
		componentId: 'sharded-counter',
		name: 'Azure Table Storage sharded counters',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/storage/tables/'
	},
	'pub-sub': {
		componentId: 'pub-sub',
		name: 'Event Hubs',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/event-hubs/'
	},
	'vector-db': {
		componentId: 'vector-db',
		name: 'Azure Database for PostgreSQL (pgvector)',
		icon: 'logos:postgresql',
		docsUrl: 'https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-use-pgvector'
	},
	'geospatial-index': {
		componentId: 'geospatial-index',
		name: 'Azure Maps',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-maps/'
	},
	'config-service': {
		componentId: 'config-service',
		name: 'App Configuration',
		icon: 'logos:microsoft-azure',
		docsUrl: 'https://learn.microsoft.com/azure/azure-app-configuration/'
	}
};
