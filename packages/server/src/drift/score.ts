import type { BehavioralContract, LiveState, RiskState } from "@zenithpulse/shared";
import { RISK_THRESHOLDS } from "@zenithpulse/shared";

interface RiskFactors {
	drawdownProximity: number;
	assetDriftCount: number;
	oversizeRatio: number;
	sharpeDegradation: number;
}

export function computeRiskFactors(contract: BehavioralContract, state: LiveState): RiskFactors {
	const drawdownProximity =
		contract.maxDrawdownPct > 0 ? state.currentDrawdown / contract.maxDrawdownPct : 0;

	const assetDriftCount =
		state.positions.filter((p) => !contract.allowedSymbols.includes(p.symbol)).length +
		state.openOrders.filter((o) => !contract.allowedSymbols.includes(o.symbol)).length;

	const oversizeRatio = Math.max(
		0,
		contract.marginBudget > 0 ? state.totalExposure / contract.marginBudget - 1 : 0,
	);

	const sharpeDegradation =
		state.rollingSharpe > 0 && contract.backTestSharpe > 0
			? Math.max(0, 1 - state.rollingSharpe / contract.backTestSharpe)
			: 0;

	return { drawdownProximity, assetDriftCount, oversizeRatio, sharpeDegradation };
}

export function computeRiskScore(contract: BehavioralContract, state: LiveState): number {
	const f = computeRiskFactors(contract, state);
	return Math.min(
		100,
		Math.max(
			f.drawdownProximity * 40,
			Math.min(f.assetDriftCount, 1) * 25,
			Math.min(f.oversizeRatio, 1) * 20,
			f.sharpeDegradation * 15,
		),
	);
}

export function getRiskState(score: number): RiskState {
	if (score >= RISK_THRESHOLDS.CRITICAL_MIN) return "critical";
	if (score > RISK_THRESHOLDS.HEALTHY_MAX) return "elevated";
	return "healthy";
}
