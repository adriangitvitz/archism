import type { SystemComponent } from '../types/component';

export const SYSTEM_COMPONENTS: SystemComponent[] = [
	{
		id: 'dns',
		label: 'DNS',
		category: 'networking',
		icon: 'Globe',
		maxQPS: 100000,
		latencyMs: 10,
		scalable: true,
		stateful: false,
		description:
			'Domain Name System - resolves human-readable domain names (e.g., example.com) to IP addresses. Every internet request starts with a DNS lookup, making it the first hop in any system design. Services like AWS Route 53 and Google Cloud DNS also support health-checked routing and geo-based load balancing.'
	},
	{
		id: 'cdn',
		label: 'CDN',
		category: 'networking',
		icon: 'Cloudy',
		maxQPS: 500000,
		latencyMs: 15,
		scalable: true,
		stateful: false,
		description:
			'Content Delivery Network - caches static assets (images, JS, CSS, videos) at edge locations close to users, reducing latency from hundreds of milliseconds to low double digits. Essential for any read-heavy or media-heavy system serving a global audience. Examples include Amazon CloudFront, Google Cloud CDN, and Cloudflare.'
	},
	{
		id: 'load-balancer',
		label: 'Load Balancer',
		category: 'networking',
		icon: 'Network',
		maxQPS: 1000000,
		latencyMs: 1,
		scalable: true,
		stateful: false,
		description:
			'Distributes incoming traffic across multiple backend servers using algorithms like round-robin, least-connections, or weighted routing. Prevents any single server from becoming a bottleneck and enables zero-downtime deployments via rolling updates. AWS ALB/NLB, Google Cloud Load Balancing, and HAProxy are common choices.'
	},
	{
		id: 'api-gateway',
		label: 'API Gateway',
		category: 'networking',
		icon: 'Router',
		maxQPS: 50000,
		latencyMs: 10,
		scalable: true,
		stateful: false,
		description:
			'Single entry point for all API requests - handles routing, authentication, rate limiting, request transformation, and protocol translation. Use it when you have multiple microservices behind a unified API surface. AWS API Gateway, Kong, and Google Cloud Apigee are popular managed options. Note that managed offerings enforce account-level quotas - AWS API Gateway defaults to 10,000 RPS per account - so the 50K QPS figure here reflects a self-hosted or scaled-out gateway tier.'
	},
	{
		id: 'rate-limiter',
		label: 'Rate Limiter',
		category: 'networking',
		icon: 'ShieldAlert',
		maxQPS: 80000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'Throttles requests per client, IP, or API key to protect downstream services from abuse, DDoS attacks, and traffic spikes. Typically implemented using token bucket or sliding window algorithms backed by Redis. Often built into API gateways like Kong, enforced at the edge via AWS WAF, or implemented as a standalone service.'
	},

	{
		id: 'app-server',
		label: 'App Server',
		category: 'compute',
		icon: 'Server',
		maxQPS: 5000,
		latencyMs: 20,
		scalable: true,
		stateful: false,
		description:
			'Stateless application server that executes core business logic and serves API requests. Designed to scale horizontally - spin up more instances behind a load balancer to handle increased traffic. Runs on AWS EC2/ECS, Google Compute Engine, or containerized in Kubernetes pods.'
	},
	{
		id: 'auth-service',
		label: 'Auth Service',
		category: 'compute',
		icon: 'KeyRound',
		maxQPS: 10000,
		latencyMs: 15,
		scalable: true,
		stateful: false,
		description:
			'Dedicated authentication and authorization service that handles user login, token issuance (JWT/OAuth2), session management, and permission checks. Centralizing auth prevents security logic from being scattered across microservices. Examples include AWS Cognito, Auth0, Firebase Auth, and Google Cloud Identity Platform.'
	},

	{
		id: 'sql-db',
		label: 'SQL Database',
		category: 'storage',
		icon: 'Database',
		maxQPS: 10000,
		latencyMs: 8,
		scalable: false,
		stateful: true,
		description:
			'Relational database providing ACID transactions, strong consistency, and structured schemas with SQL queries. Best for data with complex relationships, joins, and strict integrity requirements (e.g., financial transactions, user accounts). Examples include Amazon RDS (PostgreSQL/MySQL), Google Cloud SQL, and Amazon Aurora.'
	},
	{
		id: 'nosql-db',
		label: 'NoSQL Database',
		category: 'storage',
		icon: 'HardDrive',
		maxQPS: 50000,
		latencyMs: 3,
		scalable: true,
		stateful: true,
		description:
			'Non-relational database optimized for flexible schemas, horizontal scaling, and high-throughput workloads. Choose it when you need low-latency key-value lookups, wide-column storage, or document-oriented data without complex joins. Amazon DynamoDB, Google Cloud Bigtable, MongoDB Atlas, and Apache Cassandra are widely used.'
	},
	{
		id: 'cache',
		label: 'Cache / Redis',
		category: 'storage',
		icon: 'Zap',
		maxQPS: 100000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'In-memory data store delivering sub-millisecond read latency for frequently accessed data, session storage, leaderboards, and real-time counters. Placing a cache between your app servers and database can reduce DB load by 80-90% for read-heavy workloads. Amazon ElastiCache (Redis/Memcached) and Google Cloud Memorystore are managed options.'
	},
	{
		id: 'object-storage',
		label: 'Object Storage',
		category: 'storage',
		icon: 'Archive',
		maxQPS: 25000,
		latencyMs: 75,
		scalable: true,
		stateful: true,
		description:
			'Highly durable blob/object storage for unstructured data like images, videos, backups, and static website assets. Offers virtually unlimited capacity with 99.999999999% (11 nines) durability. Amazon S3, Google Cloud Storage, and Azure Blob Storage are the industry standards, often paired with a CDN for fast delivery.'
	},
	{
		id: 'search',
		label: 'Search / ES',
		category: 'storage',
		icon: 'Search',
		maxQPS: 20000,
		latencyMs: 10,
		scalable: true,
		stateful: true,
		description:
			'Full-text search engine that indexes and queries large volumes of text with features like fuzzy matching, faceted search, and relevance scoring. Use it when users need to search across product catalogs, logs, or content feeds. Elasticsearch (Amazon OpenSearch), Apache Solr, and Google Cloud Search are common choices.'
	},

	{
		id: 'message-queue',
		label: 'Message Queue',
		category: 'messaging',
		icon: 'MessageSquare',
		maxQPS: 100000,
		latencyMs: 5,
		scalable: true,
		stateful: true,
		description:
			'Asynchronous message broker that decouples producers from consumers, enabling reliable background processing, event-driven architectures, and traffic spike buffering. Critical for any workflow where synchronous processing would create bottlenecks or coupling. Apache Kafka, Amazon SQS/SNS, Google Cloud Pub/Sub, and RabbitMQ are widely adopted.'
	},

	{
		id: 'service-mesh',
		label: 'Service Mesh',
		category: 'infrastructure',
		icon: 'GitBranch',
		maxQPS: 80000,
		latencyMs: 2,
		scalable: true,
		stateful: false,
		description:
			'Transparent service-to-service communication layer that handles mutual TLS, retries, circuit breaking, load balancing, and distributed tracing between microservices. Use it when your microservice count grows beyond what manual configuration can manage. Istio, Linkerd, and Cloud Service Mesh are leading implementations.'
	},
	{
		id: 'monitoring',
		label: 'Monitoring',
		category: 'infrastructure',
		icon: 'Activity',
		maxQPS: 500000,
		latencyMs: 5,
		scalable: true,
		stateful: true,
		description:
			'Observability stack for metrics collection, centralized logging, distributed tracing, and alerting. Every production system needs monitoring to detect outages, track SLOs, and debug performance issues. Prometheus + Grafana, AWS CloudWatch, Google Cloud Monitoring, Datadog, and the ELK stack are standard tools.'
	},

	{
		id: 'websocket-server',
		label: 'WebSocket Server',
		category: 'compute',
		icon: 'Radio',
		maxQPS: 50000,
		latencyMs: 2,
		scalable: true,
		stateful: true,
		description:
			'Maintains persistent bidirectional connections for real-time communication. Essential for chat apps, live notifications, collaborative editing, and gaming. Libraries like Socket.io and managed services like AWS API Gateway WebSocket APIs or Pusher handle millions of concurrent connections, with connection-to-server mapping stored in Redis.'
	},
	{
		id: 'task-scheduler',
		label: 'Task Scheduler',
		category: 'compute',
		icon: 'Clock',
		maxQPS: 10000,
		latencyMs: 50,
		scalable: true,
		stateful: false,
		description:
			'Manages delayed, scheduled, and recurring background jobs with retry logic and dead-letter queues. Critical for email campaigns, report generation, data pipelines, and cleanup tasks. Celery, AWS Step Functions, Google Cloud Tasks, and Temporal are common implementations.'
	},
	{
		id: 'stream-processor',
		label: 'Stream Processor',
		category: 'compute',
		icon: 'Waves',
		maxQPS: 200000,
		latencyMs: 10,
		scalable: true,
		stateful: true,
		description:
			'Processes continuous data streams in real-time for analytics, event processing, and ETL pipelines. Handles windowed aggregations, joins, and transformations on unbounded data. Apache Kafka Streams, Apache Flink, Spark Streaming, and AWS Kinesis Data Analytics are industry standards.'
	},
	{
		id: 'notification-service',
		label: 'Notification Service',
		category: 'compute',
		icon: 'Bell',
		maxQPS: 50000,
		latencyMs: 100,
		scalable: true,
		stateful: false,
		description:
			'Orchestrates multi-channel delivery of push notifications, emails, SMS, and in-app messages with priority queuing, template rendering, and delivery tracking. Firebase Cloud Messaging, AWS SNS/SES, Twilio, and OneSignal handle billions of notifications daily with device token management.'
	},

	{
		id: 'graph-db',
		label: 'Graph Database',
		category: 'storage',
		icon: 'Share2',
		maxQPS: 8000,
		latencyMs: 15,
		scalable: true,
		stateful: true,
		description:
			'Stores and queries highly connected data using nodes, edges, and properties - optimized for relationship traversals like friend-of-friend queries, recommendation engines, and fraud detection. Neo4j, Amazon Neptune, and JanusGraph significantly outperform relational joins for multi-hop traversals.'
	},
	{
		id: 'timeseries-db',
		label: 'Time-Series DB',
		category: 'storage',
		icon: 'TrendingUp',
		maxQPS: 100000,
		latencyMs: 3,
		scalable: true,
		stateful: true,
		description:
			'Optimized for ingesting and querying time-stamped data with built-in downsampling, retention policies, and time-windowed aggregations. Essential for monitoring metrics, IoT sensor data, and financial tick data. InfluxDB, TimescaleDB, Amazon Timestream, and Prometheus TSDB are purpose-built for this workload.'
	},
	{
		id: 'data-warehouse',
		label: 'Data Warehouse',
		category: 'storage',
		icon: 'Warehouse',
		maxQPS: 50,
		latencyMs: 5000,
		scalable: true,
		stateful: true,
		description:
			'Columnar analytical database designed for complex queries across terabytes/petabytes of historical data. Separates analytics from operational databases to prevent query load from impacting production. Google BigQuery, Amazon Redshift, Snowflake, and ClickHouse support SQL analytics at massive scale.'
	},

	{
		id: 'service-discovery',
		label: 'Service Discovery',
		category: 'infrastructure',
		icon: 'Compass',
		maxQPS: 50000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'Enables microservices to find and communicate with each other dynamically without hardcoded addresses. Handles service registration, health checking, and DNS-based or API-based lookups. HashiCorp Consul, Apache ZooKeeper, etcd, and AWS Cloud Map are widely used for service mesh coordination.'
	},
	{
		id: 'reverse-proxy',
		label: 'Reverse Proxy',
		category: 'networking',
		icon: 'Shield',
		maxQPS: 100000,
		latencyMs: 1,
		scalable: true,
		stateful: false,
		description:
			'Sits between clients and backend servers to handle SSL termination, request routing, caching, compression, and security filtering. Unlike a load balancer, it can also serve cached content, rewrite URLs, and add security headers. Nginx, Envoy, Cloudflare, and AWS CloudFront function as reverse proxies.'
	},
	{
		id: 'distributed-lock',
		label: 'Distributed Lock',
		category: 'infrastructure',
		icon: 'Lock',
		maxQPS: 10000,
		latencyMs: 5,
		scalable: false,
		stateful: true,
		description:
			'Provides mutual exclusion across distributed systems to prevent race conditions in critical sections like inventory updates, leader election, and distributed transactions. Redis Redlock, Apache ZooKeeper recipes, and etcd lease-based locks are common implementations with trade-offs between safety and liveness.'
	},
	{
		id: 'circuit-breaker',
		label: 'Circuit Breaker',
		category: 'infrastructure',
		icon: 'ShieldOff',
		maxQPS: 100000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'Prevents cascading failures by monitoring downstream service health and short-circuiting requests when failure rates exceed a threshold. Implements three states: closed (normal), open (failing, reject immediately), and half-open (testing recovery). Netflix Hystrix popularized the pattern; Resilience4j, Envoy, and Istio provide modern implementations.'
	},
	{
		id: 'file-store',
		label: 'File Store',
		category: 'storage',
		icon: 'FolderOpen',
		maxQPS: 10000,
		latencyMs: 10,
		scalable: true,
		stateful: true,
		description:
			'Network-attached file storage providing POSIX-compatible file system semantics for shared access across multiple compute instances. Supports hierarchical directories, file locking, and concurrent reads/writes. Amazon EFS, Google Cloud Filestore, and Azure Files are managed options. Use when applications need a traditional file system interface rather than object/blob APIs.'
	},
	{
		id: 'origin-shield',
		label: 'Origin Shield',
		category: 'networking',
		icon: 'ShieldCheck',
		maxQPS: 200000,
		latencyMs: 5,
		scalable: true,
		stateful: false,
		description:
			'An additional caching layer between CDN edge locations and the origin server that reduces origin load by collapsing duplicate requests from multiple edge PoPs into a single origin fetch. Reduces origin bandwidth by 50-90% for popular content. AWS CloudFront Origin Shield, Cloudflare Tiered Cache, and Fastly Shield PoPs are implementations.'
	},
	{
		id: 'coordination-service',
		label: 'Coordination Service',
		category: 'infrastructure',
		icon: 'Users',
		maxQPS: 20000,
		latencyMs: 5,
		scalable: true,
		stateful: true,
		description:
			'Provides distributed coordination primitives: leader election, configuration management, distributed barriers, and group membership. Built on consensus protocols (Raft/ZAB) for strong consistency. Apache ZooKeeper, etcd, and Consul are the primary implementations. Essential for distributed systems that need agreement on shared state.'
	},
	{
		id: 'custom',
		label: 'Custom Component',
		category: 'compute',
		icon: 'Box',
		maxQPS: 50000,
		latencyMs: 10,
		scalable: true,
		stateful: false,
		description:
			'A generic component that can be renamed to represent any service, system, or infrastructure not available in the predefined component library. Double-click the node label on the canvas to rename it. Use this for specialized services like ML inference engines, recommendation services, fraud detection, content moderation, or any domain-specific component.'
	},

	{
		id: 'id-generator',
		label: 'ID Generator',
		category: 'infrastructure',
		icon: 'Fingerprint',
		maxQPS: 500000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'Generates globally unique, sortable IDs across distributed nodes using algorithms like Twitter Snowflake, ULID, or UUID. Each node embeds a timestamp, machine ID, and sequence number to guarantee uniqueness without centralized coordination. Essential for database primary keys, URL shortening, event ordering, and sharding keys.'
	},
	{
		id: 'sharded-counter',
		label: 'Sharded Counter',
		category: 'infrastructure',
		icon: 'Hash',
		maxQPS: 500000,
		latencyMs: 2,
		scalable: true,
		stateful: true,
		description:
			'Distributes a single logical counter across multiple shards to avoid hot-key bottlenecks under massive concurrent writes. Reads aggregate across shards with eventual consistency. Critical for like counts, view counters, follower counts, and real-time voting at scale. Typically backed by Redis or purpose-built counter tables with periodic reconciliation.'
	},

	{
		id: 'pub-sub',
		label: 'Pub/Sub',
		category: 'messaging',
		icon: 'Megaphone',
		maxQPS: 200000,
		latencyMs: 5,
		scalable: true,
		stateful: true,
		description:
			'Topic-based publish/subscribe messaging where each message is broadcast to all subscribers, unlike point-to-point queues where each message is consumed by one consumer. Enables event-driven fan-out for feeds, analytics pipelines, CDC, and cross-service event propagation. Google Cloud Pub/Sub, AWS SNS, and Apache Kafka topics are canonical implementations.'
	},

	{
		id: 'vector-db',
		label: 'Vector Database',
		category: 'storage',
		icon: 'Brain',
		maxQPS: 10000,
		latencyMs: 10,
		scalable: true,
		stateful: true,
		description:
			'Stores high-dimensional vector embeddings and performs approximate nearest-neighbor (ANN) search for similarity matching. Powers recommendation engines, semantic search, image search, and RAG-based AI systems. Pinecone, Weaviate, Milvus, Qdrant, and pgvector are leading implementations using HNSW or IVF indexing algorithms.'
	},
	{
		id: 'geospatial-index',
		label: 'Geospatial Index',
		category: 'storage',
		icon: 'MapPin',
		maxQPS: 50000,
		latencyMs: 5,
		scalable: true,
		stateful: true,
		description:
			'Indexes and queries location data using geohash, quadtree, R-tree, or H3 hexagonal grids for efficient nearest-neighbor and radius searches. Essential for ride-sharing, food delivery, local search, and any proximity-based system. PostGIS, Redis GEO (GEOADD/GEOSEARCH), Elasticsearch geo_point, and Google S2 library are common implementations.'
	},

	{
		id: 'config-service',
		label: 'Config Service',
		category: 'infrastructure',
		icon: 'Settings',
		maxQPS: 50000,
		latencyMs: 2,
		scalable: true,
		stateful: true,
		description:
			'Centralized dynamic configuration management for feature flags, A/B test parameters, and runtime settings without redeployment. Supports versioning, rollback, targeted rollouts by user segment, and real-time propagation to all service instances. AWS AppConfig, LaunchDarkly, Unleash, and etcd-backed config stores are common implementations.'
	},
	{
		id: 'firewall',
		label: 'Firewall',
		category: 'networking',
		icon: 'BrickWall',
		maxQPS: 100000,
		latencyMs: 1,
		scalable: true,
		stateful: true,
		description:
			'Network firewall enforcing allow/deny rules on north/south and east/west traffic (L3/L4, with FQDN and IDPS features in managed offerings). In hub-and-spoke topologies it is the central choke point every flow transits, so its capacity and availability bound the whole system. Azure Firewall, AWS Network Firewall, Google Cloud NGFW, and pfSense/iptables are common implementations.'
	},
	{
		id: 'static-hosting',
		label: 'Static Hosting',
		category: 'networking',
		icon: 'FileCode',
		maxQPS: 200000,
		latencyMs: 10,
		scalable: true,
		stateful: false,
		description:
			'Managed hosting for pre-built static assets (HTML, CSS, JS, images) served from globally distributed edge endpoints - no running server process, no compute to scale or patch. The build step produces files; the platform serves them. Azure Static Web Apps, AWS Amplify Hosting, Firebase Hosting, and GitHub Pages are typical offerings, usually paired with serverless functions for light APIs.'
	},
	{
		id: 'edge-delivery',
		label: 'Edge Delivery Platform',
		category: 'networking',
		icon: 'Globe2',
		maxQPS: 1000000,
		latencyMs: 5,
		scalable: true,
		stateful: false,
		description:
			'Global Layer-7 application delivery platform: anycast entry, TLS termination, path-based routing and global load balancing across origins with health probes, WAF, and edge caching in one service - more than a CDN, which only caches. Azure Front Door, a Global Application Load Balancer with Cloud Armor + CDN on GCP, and CloudFront with WAF on AWS are the canonical examples. Use plain CDN when you only need static asset caching.'
	},
	{
		id: 'durable-workflow',
		label: 'Workflow Orchestrator',
		category: 'infrastructure',
		icon: 'Workflow',
		maxQPS: 1000,
		latencyMs: 50,
		scalable: true,
		stateful: true,
		description:
			'Durable execution engine for stateful multi-step workflows: each step is checkpointed so long-running processes survive crashes and redeploys, with retries, timers, compensation (sagas), and human-in-the-loop waits. Distinct from a task scheduler (fire-and-forget jobs) and a stream processor (unbounded data). Temporal, AWS Step Functions, GCP Workflows, and Azure Logic Apps are canonical implementations.'
	},
	{
		id: 'serverless-container',
		label: 'Serverless Containers',
		category: 'compute',
		icon: 'Container',
		maxQPS: 4000,
		latencyMs: 25,
		scalable: true,
		stateful: false,
		description:
			'Serverless container platform: bring a container image, the platform runs it on managed orchestration with request/event-driven autoscaling (KEDA-style), scale-to-zero, and consumption pricing - no always-on server or cluster to manage. Distinct from an App Server (always-on runtime, plan-based billing). Azure Container Apps, Google Cloud Run, AWS App Runner, and Knative are canonical implementations. Cold starts apply after scale-to-zero.'
	},
	{
		id: 'faas',
		label: 'Function (FaaS)',
		category: 'compute',
		icon: 'Zap',
		maxQPS: 10000,
		latencyMs: 50,
		scalable: true,
		stateful: false,
		description:
			'Event/HTTP-triggered serverless functions: per-invocation compute with scale-to-zero, per-execution billing, cold-start latency spikes, and hard concurrency ceilings (throttling, not saturation, is the failure mode). Distinct from Serverless Containers (bring-an-image, longer-lived replicas) and App Servers (always-on). AWS Lambda, Azure Functions, Cloud Run functions, and OpenFaaS are canonical.'
	},
	{
		id: 'secrets-manager',
		label: 'Secrets Manager',
		category: 'infrastructure',
		icon: 'KeyRound',
		maxQPS: 10000,
		latencyMs: 20,
		scalable: true,
		stateful: true,
		description:
			'Encrypted, IAM-audited store for runtime credentials, certificates, and keys - fetched at boot and rotation, with strict per-vault throttling and HSM backing. An outage blocks new instance startup fleet-wide. Distinct from Config Service (feature flags / dynamic settings). AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, and HashiCorp Vault are canonical.'
	},
	{
		id: 'event-bus',
		label: 'Event Bus / Router',
		category: 'messaging',
		icon: 'Route',
		maxQPS: 50000,
		latencyMs: 50,
		scalable: true,
		stateful: true,
		description:
			'Content-based event routing: the bus (not the publisher) evaluates rules on event payloads and fans out to heterogeneous targets with per-subscription retries, DLQs, and archive/replay. Distinct from Pub/Sub (partitioned-log topic broadcast) and Message Queue (point-to-point). EventBridge, Event Grid, Eventarc, and NATS JetStream are canonical.'
	},
	{
		id: 'private-connectivity',
		label: 'Private Connectivity Gateway',
		category: 'networking',
		icon: 'Cable',
		maxQPS: 50000,
		latencyMs: 5,
		scalable: false,
		stateful: false,
		description:
			'Terminates private links between cloud networks and on-prem/partner sites (IPsec tunnels or dedicated circuits) and transits hub-and-spoke traffic. Bandwidth is provisioned per SKU/circuit - a fixed capacity choke point, not horizontally scalable. AWS Transit Gateway + Direct Connect, Azure VPN Gateway/ExpressRoute, Cloud Interconnect, and WireGuard hubs are canonical.'
	},
	{
		id: 'ml-inference',
		label: 'ML Inference Endpoint',
		category: 'compute',
		icon: 'Brain',
		maxQPS: 500,
		latencyMs: 500,
		scalable: true,
		stateful: false,
		description:
			'Model-serving endpoint: GPU/accelerator-bound replicas with low per-replica throughput, high tail latency, token/compute metering, and slow expensive scale-out (capacity provisioning). Behaviorally nothing like a CPU app server. Amazon Bedrock/SageMaker endpoints, Azure OpenAI, Vertex AI endpoints, and vLLM/Triton are canonical.'
	},
	{
		id: 'etl-pipeline',
		label: 'Batch ETL Pipeline',
		category: 'infrastructure',
		icon: 'ArrowRightLeft',
		maxQPS: 50,
		latencyMs: 10000,
		scalable: true,
		stateful: true,
		description:
			'Scheduled bulk data movement and transformation between operational stores, lakes, and the warehouse - throughput in GB per run, latencies in minutes, spiky scheduled load on sources and sinks. Distinct from Stream Processor (unbounded real-time) and Workflow Orchestrator (app-level sagas). Glue, Data Factory, Cloud Composer, and Airflow+Spark are canonical.'
	},
	{
		id: 'distributed-sql',
		label: 'Distributed SQL',
		category: 'storage',
		icon: 'DatabaseZap',
		maxQPS: 30000,
		latencyMs: 10,
		scalable: true,
		stateful: true,
		description:
			"Horizontally scalable, strongly consistent relational database with synchronous multi-region replication and online resharding - the negation of the classic single-primary SQL database's vertical-scaling limit. Cloud Spanner, Aurora DSQL, Cosmos DB for PostgreSQL, and CockroachDB/TiDB are canonical."
	}
];

export const COMPONENT_CATEGORIES = [
	{ key: 'networking', label: 'Networking' },
	{ key: 'compute', label: 'Compute' },
	{ key: 'storage', label: 'Storage' },
	{ key: 'messaging', label: 'Messaging' },
	{ key: 'infrastructure', label: 'Infrastructure' }
] as const;

const COMPONENT_INDEX = new Map(SYSTEM_COMPONENTS.map((c) => [c.id, c]));

export function getComponentById(id: string): SystemComponent | undefined {
	return COMPONENT_INDEX.get(id);
}
