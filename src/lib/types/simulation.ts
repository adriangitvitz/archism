export type NodeStatus = 'healthy' | 'warning' | 'critical' | 'idle';

export interface NodeMetrics {
	nodeId: string;
	incomingQPS: number;
	effectiveQPS: number;
	utilization: number;
	latencyMs: number;
	status: NodeStatus;
	isBottleneck: boolean;
}

export interface SimulationResult {
	nodeMetrics: Map<string, NodeMetrics>;
	totalLatencyMs: number;
	bottleneckNodes: string[];
	throughput: number;
	timestamp: number;
	warnings: string[];
}

export interface SimulationConfig {
	requestsPerSec: number;
	durationSec: number;
	rampUp: boolean;
}
