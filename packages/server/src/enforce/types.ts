export type EnforcementAction =
	| { type: "none"; reason: string }
	| { type: "cancel_order"; orderId: string; symbol: string; reason: string }
	| { type: "cancel_plan_order"; orderId: string; symbol: string; reason: string }
	| { type: "close_position"; symbol: string; holdSide: string; size: string; reason: string };

export type EnforcementPlan = {
	actions: EnforcementAction[];
	mode: string;
};

export type ActionResult = {
	success: boolean;
	action: EnforcementAction;
	error?: string;
};
