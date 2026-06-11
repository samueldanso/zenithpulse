import type { OperatingMode, RiskState } from "./types.js";

export const OPERATING_MODES: OperatingMode[] = ["enforce", "observe", "silent"];

export const RISK_STATES: RiskState[] = ["healthy", "elevated", "critical"];

export const RISK_THRESHOLDS = {
	HEALTHY_MAX: 39,
	ELEVATED_MAX: 69,
	CRITICAL_MIN: 70,
} as const;

export const RISK_WEIGHTS = {
	DRAWDOWN: 40,
	ASSET_DRIFT: 25,
	OVERSIZE: 20,
	SHARPE_DEGRADATION: 15,
} as const;

export const DEFAULT_POLL_INTERVAL_MS = 15_000;
export const DEFAULT_PORT = 3001;
export const DEFAULT_MODE: OperatingMode = "observe";
export const DEFAULT_DB_PATH = "./data/zenithpulse.db";

export function riskStateFromScore(score: number): RiskState {
	if (score >= RISK_THRESHOLDS.CRITICAL_MIN) return "critical";
	if (score > RISK_THRESHOLDS.HEALTHY_MAX) return "elevated";
	return "healthy";
}
