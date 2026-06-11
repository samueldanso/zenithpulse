import type { BehavioralContract } from "@zenithpulse/shared";
import type { PlaybookData } from "./schema.js";

const DEFAULTS = {
	allowedSymbols: ["BTCUSDT"],
	maxDrawdownPct: 10,
	backTestSharpe: 1.0,
	marginBudget: 100,
	executionMode: "follow_trade" as const,
	expectedReturnPct: 0,
	totalTrades: 0,
};

export function deriveContract(playbookId: string, playbook: PlaybookData): BehavioralContract {
	const metrics = playbook.official_metrics;

	const allowedSymbols =
		playbook.trading_symbols ?? warnDefault("trading_symbols", DEFAULTS.allowedSymbols);

	const maxDrawdownPct =
		metrics?.max_drawdown_pct ?? warnDefault("max_drawdown_pct", DEFAULTS.maxDrawdownPct);

	const backTestSharpe =
		metrics?.sharpe_ratio ?? warnDefault("sharpe_ratio", DEFAULTS.backTestSharpe);

	const expectedReturnPct =
		metrics?.total_return_pct ?? warnDefault("total_return_pct", DEFAULTS.expectedReturnPct);

	const totalTrades = metrics?.total_trades ?? warnDefault("total_trades", DEFAULTS.totalTrades);

	const executionMode =
		playbook.execution_mode ?? warnDefault("execution_mode", DEFAULTS.executionMode);

	const metricsMarginBudget = metrics?.margin_budget;
	const marginBudgetEnv = process.env.PLAYBOOK_MARGIN_BUDGET;
	const parsedEnv = marginBudgetEnv ? Number(marginBudgetEnv) : Number.NaN;
	const marginBudget = metricsMarginBudget
		? metricsMarginBudget
		: Number.isFinite(parsedEnv)
			? parsedEnv
			: DEFAULTS.marginBudget;

	return {
		playbookId,
		derivedAt: new Date().toISOString(),
		allowedSymbols,
		maxDrawdownPct,
		backTestSharpe,
		marginBudget,
		executionMode,
		expectedReturnPct,
		totalTrades,
	};
}

function warnDefault<T>(field: string, defaultValue: T): T {
	console.warn(
		`[contract] Missing field "${field}" — using default: ${JSON.stringify(defaultValue)}`,
	);
	return defaultValue;
}
