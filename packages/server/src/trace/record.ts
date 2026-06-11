import type {
	BehavioralContract,
	DecisionTrace,
	DriftResult,
	LiveState,
	RiskState,
} from "@zenithpulse/shared";
import type { ActionResult } from "../enforce/types.js";

export interface BuildTraceParams {
	playbookId: string;
	cycleId: string;
	liveState: LiveState;
	contract: BehavioralContract;
	driftResults: DriftResult[];
	riskScore: number;
	riskState: RiskState;
	actionResults: ActionResult[];
}

export function buildTrace(params: BuildTraceParams): DecisionTrace {
	const {
		playbookId,
		cycleId,
		liveState,
		contract,
		driftResults,
		riskScore,
		riskState,
		actionResults,
	} = params;

	const firstAction = actionResults.find((r) => r.action.type !== "none");
	const enforcementAction = firstAction ? firstAction.action.type : "none";

	let actionTarget: string | undefined;
	if (firstAction && firstAction.action.type !== "none") {
		if ("orderId" in firstAction.action) {
			actionTarget = firstAction.action.orderId;
		} else if ("symbol" in firstAction.action) {
			actionTarget = firstAction.action.symbol;
		}
	}

	let actionResult: "success" | "failed" | undefined;
	if (enforcementAction !== "none" && firstAction) {
		actionResult = firstAction.success ? "success" : "failed";
	}

	let actionError: string | undefined;
	if (actionResult === "failed" && firstAction) {
		actionError = firstAction.error;
	}

	const reasoning = buildReasoning(driftResults, riskScore, riskState, actionResults);

	return {
		id: crypto.randomUUID(),
		cycleId,
		playbookId,
		timestamp: new Date().toISOString(),
		liveStateSnapshot: liveState,
		contractSnapshot: contract,
		driftResults,
		riskScore,
		riskState,
		enforcementAction,
		actionTarget,
		actionResult,
		actionError,
		reasoning,
	};
}

function buildReasoning(
	driftResults: DriftResult[],
	riskScore: number,
	riskState: RiskState,
	actionResults: ActionResult[],
): string {
	const violations = driftResults.filter((d) => d.result === "violation");
	const totalRules = driftResults.length;
	const hasActions = actionResults.some((r) => r.action.type !== "none");
	const isObserveMode = !hasActions && violations.length > 0;

	if (violations.length === 0) {
		return `All ${totalRules} rules passed. Risk score ${riskScore} (${riskState}). No action taken.`;
	}

	const violationDescriptions = violations.map((v) => formatViolation(v));

	let actionSummary: string;
	if (isObserveMode) {
		actionSummary = "Mode: observe — no action taken.";
	} else if (hasActions) {
		actionSummary = formatActionSummary(actionResults);
	} else {
		actionSummary = "No action taken.";
	}

	if (violations.length === 1) {
		return `Detected ${violationDescriptions[0]}. Risk score ${riskScore} (${riskState}). ${actionSummary}`;
	}

	const names = violationDescriptions.join(", ");
	return `Detected ${violations.length} violations: ${names}. Risk score ${riskScore} (${riskState}). ${actionSummary}`;
}

function formatViolation(drift: DriftResult): string {
	switch (drift.ruleId) {
		case "asset-drift":
			return `asset_drift: ${drift.observedValue} order not in allowed set [${drift.contractBound}]`;
		case "drawdown-breach":
			return `drawdown_breach (${drift.observedValue}% > ${drift.contractBound}%)`;
		case "oversize":
			return `oversize (exposure ${drift.observedValue} > budget ${drift.contractBound})`;
		case "sharpe-degradation":
			return `sharpe_degradation (${drift.observedValue} < ${drift.contractBound})`;
		default:
			return `${drift.ruleId} (${drift.observedValue} vs ${drift.contractBound})`;
	}
}

function formatActionSummary(actionResults: ActionResult[]): string {
	const executed = actionResults.filter((r) => r.action.type !== "none");
	if (executed.length === 0) return "No action taken.";

	if (executed.length === 1) {
		const r = executed[0];
		if (r.action.type === "cancel_order" || r.action.type === "cancel_plan_order") {
			const target = "orderId" in r.action ? r.action.orderId : "unknown";
			return `Action: cancelled order ${target}.`;
		}
		if (r.action.type === "close_position") {
			return `Action: closed position ${r.action.symbol}.`;
		}
	}

	const cancels = executed.filter(
		(r) => r.action.type === "cancel_order" || r.action.type === "cancel_plan_order",
	);
	const closes = executed.filter((r) => r.action.type === "close_position");
	const parts: string[] = [];

	if (cancels.length > 0)
		parts.push(`cancelled ${cancels.length} order${cancels.length > 1 ? "s" : ""}`);
	if (closes.length > 0)
		parts.push(`closed ${closes.length} position${closes.length > 1 ? "s" : ""}`);

	return `Actions: ${parts.join(", ")}.`;
}
