import type { ProviderMapping } from '../../types/provider';

export const AWS_MAPPING: ProviderMapping = {
	faas: {
		componentId: 'faas',
		name: 'AWS Lambda',
		icon: 'logos:aws-lambda',
		docsUrl: 'https://docs.aws.amazon.com/lambda/'
	},
	'secrets-manager': {
		componentId: 'secrets-manager',
		name: 'AWS Secrets Manager',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/secretsmanager/'
	},
	'event-bus': {
		componentId: 'event-bus',
		name: 'Amazon EventBridge',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/eventbridge/'
	},
	'private-connectivity': {
		componentId: 'private-connectivity',
		name: 'AWS Transit Gateway (+ Direct Connect/VPN)',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/vpc/latest/tgw/'
	},
	'ml-inference': {
		componentId: 'ml-inference',
		name: 'Amazon Bedrock',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/bedrock/'
	},
	'etl-pipeline': {
		componentId: 'etl-pipeline',
		name: 'AWS Glue',
		icon: 'logos:aws-glue',
		docsUrl: 'https://docs.aws.amazon.com/glue/'
	},
	'distributed-sql': {
		componentId: 'distributed-sql',
		name: 'Aurora DSQL',
		icon: 'logos:aws-aurora',
		docsUrl: 'https://docs.aws.amazon.com/aurora-dsql/'
	},
	'serverless-container': {
		componentId: 'serverless-container',
		name: 'AWS App Runner',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/apprunner/'
	},
	'durable-workflow': {
		componentId: 'durable-workflow',
		name: 'AWS Step Functions',
		icon: 'logos:aws-step-functions',
		docsUrl: 'https://docs.aws.amazon.com/step-functions/'
	},
	'edge-delivery': {
		componentId: 'edge-delivery',
		name: 'CloudFront + AWS WAF (app delivery)',
		icon: 'logos:aws-cloudfront',
		docsUrl: 'https://docs.aws.amazon.com/cloudfront/'
	},
	'static-hosting': {
		componentId: 'static-hosting',
		name: 'AWS Amplify Hosting',
		icon: 'logos:aws-amplify',
		docsUrl: 'https://docs.aws.amazon.com/amplify/'
	},
	firewall: {
		componentId: 'firewall',
		name: 'AWS Network Firewall',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/network-firewall/'
	},
	dns: {
		componentId: 'dns',
		name: 'Route 53',
		icon: 'logos:aws-route53',
		docsUrl: 'https://docs.aws.amazon.com/route53/'
	},
	cdn: {
		componentId: 'cdn',
		name: 'CloudFront',
		icon: 'logos:aws-cloudfront',
		docsUrl: 'https://docs.aws.amazon.com/cloudfront/'
	},
	'load-balancer': {
		componentId: 'load-balancer',
		name: 'Application Load Balancer',
		icon: 'logos:aws-elb',
		docsUrl: 'https://docs.aws.amazon.com/elasticloadbalancing/'
	},
	'api-gateway': {
		componentId: 'api-gateway',
		name: 'API Gateway (REST/HTTP APIs)',
		icon: 'logos:aws-api-gateway',
		docsUrl: 'https://docs.aws.amazon.com/apigateway/',
		constraints: [
			{
				id: 'aws.api-gateway.account-rps',
				check: 'maxQPS-cap',
				params: { cap: 10000 },
				message:
					'AWS API Gateway defaults to a 10,000 RPS account-level throttle. Request a quota increase for higher sustained traffic.',
				severity: 'warning'
			}
		]
	},
	'rate-limiter': {
		componentId: 'rate-limiter',
		name: 'AWS WAF (rate-based rules)',
		icon: 'logos:aws-waf',
		docsUrl: 'https://docs.aws.amazon.com/waf/'
	},
	'app-server': {
		componentId: 'app-server',
		name: 'EC2',
		icon: 'logos:aws-ec2',
		docsUrl: 'https://docs.aws.amazon.com/ec2/'
	},
	'auth-service': {
		componentId: 'auth-service',
		name: 'Cognito',
		icon: 'logos:aws-cognito',
		docsUrl: 'https://docs.aws.amazon.com/cognito/'
	},
	'sql-db': {
		componentId: 'sql-db',
		name: 'RDS for PostgreSQL',
		icon: 'logos:aws-rds',
		docsUrl: 'https://docs.aws.amazon.com/rds/',
		constraints: [
			{
				id: 'aws.sql-db.vertical-scaling',
				check: 'no-autoscale',
				message:
					'RDS scales writes vertically (bigger instance) plus read replicas - there is no horizontal write autoscaling. Plan instance sizing and failover windows.',
				severity: 'warning'
			}
		]
	},
	'nosql-db': {
		componentId: 'nosql-db',
		name: 'DynamoDB',
		icon: 'logos:aws-dynamodb',
		docsUrl: 'https://docs.aws.amazon.com/dynamodb/'
	},
	cache: {
		componentId: 'cache',
		name: 'ElastiCache (Valkey/Redis OSS)',
		icon: 'logos:aws-elasticache',
		docsUrl: 'https://docs.aws.amazon.com/elasticache/'
	},
	'object-storage': {
		componentId: 'object-storage',
		name: 'S3',
		icon: 'logos:aws-s3',
		docsUrl: 'https://docs.aws.amazon.com/s3/'
	},
	search: {
		componentId: 'search',
		name: 'OpenSearch Service',
		icon: 'logos:aws-open-search',
		docsUrl: 'https://docs.aws.amazon.com/opensearch-service/'
	},
	'message-queue': {
		componentId: 'message-queue',
		name: 'SQS',
		icon: 'logos:aws-sqs',
		docsUrl: 'https://docs.aws.amazon.com/sqs/'
	},
	'service-mesh': {
		componentId: 'service-mesh',
		name: 'VPC Lattice',
		icon: 'logos:aws-vpc',
		docsUrl: 'https://docs.aws.amazon.com/vpc-lattice/'
	},
	monitoring: {
		componentId: 'monitoring',
		name: 'CloudWatch',
		icon: 'logos:aws-cloudwatch',
		docsUrl: 'https://docs.aws.amazon.com/cloudwatch/'
	},
	'websocket-server': {
		componentId: 'websocket-server',
		name: 'API Gateway (WebSocket API)',
		icon: 'logos:aws-api-gateway',
		docsUrl:
			'https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html',
		constraints: [
			{
				id: 'aws.websocket-server.account-rps',
				check: 'maxQPS-cap',
				params: { cap: 10000 },
				message:
					'API Gateway WebSocket APIs share the 10,000 RPS default account throttle; new-connection rate is also capped per account.',
				severity: 'warning'
			}
		]
	},
	'task-scheduler': {
		componentId: 'task-scheduler',
		name: 'EventBridge Scheduler',
		icon: 'logos:aws-eventbridge',
		docsUrl: 'https://docs.aws.amazon.com/scheduler/'
	},
	'stream-processor': {
		componentId: 'stream-processor',
		name: 'Managed Service for Apache Flink',
		icon: 'logos:aws-kinesis',
		docsUrl: 'https://docs.aws.amazon.com/managed-flink/'
	},
	'notification-service': {
		componentId: 'notification-service',
		name: 'AWS End User Messaging',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/sms-voice/'
	},
	'graph-db': {
		componentId: 'graph-db',
		name: 'Neptune',
		icon: 'logos:aws-neptune',
		docsUrl: 'https://docs.aws.amazon.com/neptune/'
	},
	'timeseries-db': {
		componentId: 'timeseries-db',
		name: 'Timestream for InfluxDB',
		icon: 'logos:aws-timestream',
		docsUrl:
			'https://docs.aws.amazon.com/timestream/latest/developerguide/timestream-for-influxdb.html'
	},
	'data-warehouse': {
		componentId: 'data-warehouse',
		name: 'Redshift',
		icon: 'logos:aws-redshift',
		docsUrl: 'https://docs.aws.amazon.com/redshift/'
	},
	'service-discovery': {
		componentId: 'service-discovery',
		name: 'Cloud Map',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/cloud-map/'
	},
	'reverse-proxy': {
		componentId: 'reverse-proxy',
		name: 'Nginx on EC2 (self-managed)',
		icon: 'logos:nginx',
		docsUrl: 'https://nginx.org/en/docs/'
	},
	'distributed-lock': {
		componentId: 'distributed-lock',
		name: 'etcd locks on EC2 (self-managed)',
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
		name: 'EFS',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/efs/'
	},
	'origin-shield': {
		componentId: 'origin-shield',
		name: 'CloudFront Origin Shield',
		icon: 'logos:aws-cloudfront',
		docsUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/origin-shield.html'
	},
	'coordination-service': {
		componentId: 'coordination-service',
		name: 'ZooKeeper on EC2 (self-managed)',
		icon: 'lucide:users',
		docsUrl: 'https://zookeeper.apache.org/documentation.html'
	},
	'id-generator': {
		componentId: 'id-generator',
		name: 'Snowflake ID service on EC2 (custom)',
		icon: 'lucide:fingerprint',
		docsUrl: 'https://docs.aws.amazon.com/ec2/'
	},
	'sharded-counter': {
		componentId: 'sharded-counter',
		name: 'MemoryDB sharded counters',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/memorydb/'
	},
	'pub-sub': {
		componentId: 'pub-sub',
		name: 'SNS',
		icon: 'logos:aws-sns',
		docsUrl: 'https://docs.aws.amazon.com/sns/'
	},
	'vector-db': {
		componentId: 'vector-db',
		name: 'Aurora PostgreSQL (pgvector)',
		icon: 'logos:aws-aurora',
		docsUrl: 'https://aws.amazon.com/rds/aurora/'
	},
	'geospatial-index': {
		componentId: 'geospatial-index',
		name: 'Amazon Location Service',
		icon: 'logos:aws',
		docsUrl: 'https://docs.aws.amazon.com/location/'
	},
	'config-service': {
		componentId: 'config-service',
		name: 'AppConfig',
		icon: 'logos:aws-systems-manager',
		docsUrl: 'https://docs.aws.amazon.com/appconfig/'
	}
};
