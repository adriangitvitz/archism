export interface ScoringGraph {
	adjacency: Map<string, string[]>;

	reachable: Set<string>;
}

export interface CategoryScore {
	category: string;
	score: number;
	maxScore: number;
	feedback: string[];
	passed: string[];
}

export interface ScoreResult {
	total: number;
	categories: CategoryScore[];
	verdict: string;
	verdictColor: string;
	summary: string;
}
