import { describe, expect, it, vi } from "vitest";
import { deriveContract } from "../../src/contract/derive.js";
import type { PlaybookData } from "../../src/contract/schema.js";

const FULL_PLAYBOOK: PlaybookData = {
	strategy_id: "btc-ema-cross",
	name: "BTC EMA Cross",
	trading_symbols: ["BTCUSDT"],
	official_metrics: {
		max_drawdown_pct: 12.5,
		sharpe_ratio: 1.8,
		total_return_pct: 45.2,
		total_trades: 142,
		margin_budget: 1000,
	},
	execution_mode: "follow_trade",
};

describe("deriveContract", () => {
	it("maps trading_symbols to allowedSymbols", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.allowedSymbols).toEqual(["BTCUSDT"]);
	});

	it("maps max_drawdown_pct to maxDrawdownPct", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.maxDrawdownPct).toBe(12.5);
	});

	it("maps sharpe_ratio to backTestSharpe", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.backTestSharpe).toBe(1.8);
	});

	it("maps total_return_pct to expectedReturnPct", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.expectedReturnPct).toBe(45.2);
	});

	it("maps total_trades to totalTrades", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.totalTrades).toBe(142);
	});

	it("maps execution_mode to executionMode", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.executionMode).toBe("follow_trade");
	});

	it("populates all BehavioralContract fields", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.playbookId).toBe("test-id");
		expect(contract.derivedAt).toBeTruthy();
		expect(contract.allowedSymbols).toBeDefined();
		expect(contract.maxDrawdownPct).toBeDefined();
		expect(contract.backTestSharpe).toBeDefined();
		expect(contract.marginBudget).toBeDefined();
		expect(contract.executionMode).toBeDefined();
		expect(contract.expectedReturnPct).toBeDefined();
		expect(contract.totalTrades).toBeDefined();
	});

	it("uses margin_budget from official_metrics when available", () => {
		process.env.PLAYBOOK_MARGIN_BUDGET = "250";
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(contract.marginBudget).toBe(1000);
		process.env.PLAYBOOK_MARGIN_BUDGET = undefined;
	});

	it("falls back to PLAYBOOK_MARGIN_BUDGET env var when metrics lack margin_budget", () => {
		process.env.PLAYBOOK_MARGIN_BUDGET = "250";
		const noMarginBudget: PlaybookData = {
			...FULL_PLAYBOOK,
			official_metrics: {
				max_drawdown_pct: 12.5,
				sharpe_ratio: 1.8,
				total_return_pct: 45.2,
				total_trades: 142,
			},
		};
		const contract = deriveContract("test-id", noMarginBudget);
		expect(contract.marginBudget).toBe(250);
		process.env.PLAYBOOK_MARGIN_BUDGET = undefined;
	});

	it("uses default marginBudget when neither metrics nor env var provide it", () => {
		process.env.PLAYBOOK_MARGIN_BUDGET = undefined;
		const noMarginBudget: PlaybookData = {
			...FULL_PLAYBOOK,
			official_metrics: {
				max_drawdown_pct: 12.5,
				sharpe_ratio: 1.8,
				total_return_pct: 45.2,
				total_trades: 142,
			},
		};
		const contract = deriveContract("test-id", noMarginBudget);
		expect(contract.marginBudget).toBe(100);
	});

	it("uses defaults and warns for missing fields", () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const minimal: PlaybookData = {
			strategy_id: "minimal",
			name: "Minimal",
		};

		const contract = deriveContract("minimal", minimal);
		expect(contract.allowedSymbols).toEqual(["BTCUSDT"]);
		expect(contract.maxDrawdownPct).toBe(10);
		expect(contract.backTestSharpe).toBe(1.0);
		expect(contract.expectedReturnPct).toBe(0);
		expect(contract.totalTrades).toBe(0);
		expect(contract.executionMode).toBe("follow_trade");
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});

	it("produces ISO timestamp in derivedAt", () => {
		const contract = deriveContract("test-id", FULL_PLAYBOOK);
		expect(() => new Date(contract.derivedAt)).not.toThrow();
		expect(new Date(contract.derivedAt).toISOString()).toBe(contract.derivedAt);
	});
});
