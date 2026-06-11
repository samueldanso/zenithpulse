import type { BehavioralContract, DriftResult, LiveState } from "@zenithpulse/shared";

export function detectAssetDrift(contract: BehavioralContract, state: LiveState): DriftResult {
	const unauthorizedSymbols = new Set<string>();

	for (const order of state.openOrders) {
		if (!contract.allowedSymbols.includes(order.symbol)) {
			unauthorizedSymbols.add(order.symbol);
		}
	}

	for (const position of state.positions) {
		if (!contract.allowedSymbols.includes(position.symbol)) {
			unauthorizedSymbols.add(position.symbol);
		}
	}

	const driftCount = unauthorizedSymbols.size;
	const observed = driftCount > 0 ? [...unauthorizedSymbols].join(",") : "none";

	return {
		ruleId: "asset-drift",
		ruleName: "Asset Drift",
		contractField: "allowedSymbols",
		result: driftCount > 0 ? "violation" : "pass",
		observedValue: observed,
		contractBound: contract.allowedSymbols.join(","),
		severity: driftCount > 0 ? 1 : 0,
	};
}

export function detectOversize(contract: BehavioralContract, state: LiveState): DriftResult {
	const ratio = contract.marginBudget > 0 ? state.totalExposure / contract.marginBudget : 0;
	const breached = state.totalExposure > contract.marginBudget;

	return {
		ruleId: "oversize",
		ruleName: "Position Oversize",
		contractField: "marginBudget",
		result: breached ? "violation" : "pass",
		observedValue: state.totalExposure,
		contractBound: contract.marginBudget,
		severity: breached ? Math.min(1, ratio - 1) : 0,
	};
}

export function detectDrawdownBreach(contract: BehavioralContract, state: LiveState): DriftResult {
	const proximity =
		contract.maxDrawdownPct > 0 ? state.currentDrawdown / contract.maxDrawdownPct : 0;
	const breached = state.currentDrawdown > contract.maxDrawdownPct;

	return {
		ruleId: "drawdown-breach",
		ruleName: "Drawdown Breach",
		contractField: "maxDrawdownPct",
		result: breached ? "violation" : "pass",
		observedValue: state.currentDrawdown,
		contractBound: contract.maxDrawdownPct,
		severity: breached ? Math.min(1, proximity) : 0,
	};
}

export function detectSharpeDegradation(
	contract: BehavioralContract,
	state: LiveState,
): DriftResult {
	const bothPositive = state.rollingSharpe > 0 && contract.backTestSharpe > 0;
	const degraded = bothPositive && state.rollingSharpe < contract.backTestSharpe;
	const degradation = bothPositive
		? Math.max(0, 1 - state.rollingSharpe / contract.backTestSharpe)
		: 0;

	return {
		ruleId: "sharpe-degradation",
		ruleName: "Sharpe Degradation",
		contractField: "backTestSharpe",
		result: degraded ? "warn" : "pass",
		observedValue: state.rollingSharpe,
		contractBound: contract.backTestSharpe,
		severity: degraded ? Math.min(1, degradation) : 0,
	};
}
