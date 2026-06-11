export type OperatingMode = "enforce" | "observe" | "silent";

export type RiskState = "healthy" | "elevated" | "critical";

export type RuleResult = "pass" | "warn" | "violation";

export type EnforcementAction = "none" | "cancel_order" | "cancel_plan_order" | "close_position";

export interface BehavioralContract {
	playbookId: string;
	derivedAt: string;
	allowedSymbols: string[];
	maxDrawdownPct: number;
	backTestSharpe: number;
	marginBudget: number;
	executionMode: "signal_only" | "follow_trade";
	expectedReturnPct: number;
	totalTrades: number;
}

export interface Order {
	orderId: string;
	symbol: string;
	side: string;
	orderType: string;
	price: string;
	size: string;
	status: string;
	createTime: string;
}

export interface PlanOrder {
	orderId: string;
	symbol: string;
	side: string;
	planType: string;
	triggerPrice: string;
	size: string;
	status: string;
	createTime: string;
}

export interface Position {
	symbol: string;
	holdSide: string;
	total: string;
	available: string;
	averageOpenPrice: string;
	unrealizedPL: string;
	marginSize: string;
	leverage: string;
}

export interface LiveState {
	timestamp: string;
	accountBalance: number;
	openOrders: Order[];
	openPlanOrders: PlanOrder[];
	positions: Position[];
	currentDrawdown: number;
	totalExposure: number;
	rollingSharpe: number;
}

export interface DriftResult {
	ruleId: string;
	ruleName: string;
	contractField: string;
	result: RuleResult;
	observedValue: number | string;
	contractBound: number | string;
	severity: number;
}

export interface DecisionTrace {
	id: string;
	cycleId: string;
	playbookId: string;
	timestamp: string;
	liveStateSnapshot: LiveState;
	contractSnapshot: BehavioralContract;
	driftResults: DriftResult[];
	riskScore: number;
	riskState: RiskState;
	enforcementAction: EnforcementAction;
	actionTarget?: string;
	actionResult?: "success" | "failed";
	actionError?: string;
	reasoning: string;
}
