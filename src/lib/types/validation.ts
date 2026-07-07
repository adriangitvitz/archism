export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
	ruleId: string;
	severity: IssueSeverity;
	message: string;
	nodeIds: string[];
	provider?: string;
}
