import type { BehavioralContract, DriftResult, LiveState } from "@zenithpulse/shared";
import { describe, expect, it } from "vitest";
import type { ActionResult } from "../../src/enforce/types.js";
import { buildTrace } from "../../src/trace/record.js";

const SAMPLE_CONTRACT: BehavioralContract = {
	playbookId: "btc-ema",
	derivedAt: "2026-06-10T12:00:00.000Z",
	allowedSymbols: ["BTCUSDT"],
	maxDrawdownPct: 6.84,
	backTestSharpe: 1.5,
	marginBudget: 100,
	executionMode: "follow_trade",
	expectedReturnPct: 30,
	totalTrades: 100,
};

const SAMPLE_LIVE_STATE: LiveState = {
	timestamp: "2026-06-11T12:00:00.000Z",
	accountBalance: 1000,
	openOrders: [],
	openPlanOrders: [],
	positions: [],
	currentDrawdown: 2.5,
	totalExposure: 50,
	rollingSharpe: 1.2,
};

function makePassingDrifts(): DriftResult[] {
	return [
		{
			ruleId: "asset-drift",
			ruleName: "Asset Drift",
			contractField: "allowedSymbols",
			result: "pass",
			observedValue: "none",
			contractBound: "BTCUSDT",
			severity: 0,
		},
		{
			ruleId: "oversize",
			ruleName: "Oversize",
			contractField: "marginBudget",
			result: "pass",
			observedValue: 50,
			contractBound: 100,
			severity: 0,
		},
		{
			ruleId: "drawdown-breach",
			ruleName: "Drawdown Breach",
			contractField: "maxDrawdownPct",
			result: "pass",
			observedValue: 2.5,
			contractBound: 6.84,
			severity: 0,
		},
		{
			ruleId: "sharpe-degradation",
			ruleName: "Sharpe Degradation",
			contractField: "backTestSharpe",
			result: "pass",
			observedValue: 1.2,
			contractBound: 1.5,
			severity: 0,
		},
	];
}

function makeNoActionResults(): ActionResult[] {
	return [{ success: true, action: { type: "none", reason: "no violations" } }];
}

describe("buildTrace", () => {
	it("all rules pass — reasoning says all passed, no action", () => {
		const trace = buildTrace({
			playbookId: "btc-ema",
			cycleId: "cycle-1",
			liveState: SAMPLE_LIVE_STATE,
			contract: SAMPLE_CONTRACT,
			driftResults: makePassingDrifts(),
			riskScore: 0,
			riskState: "healthy",
			actionResults: makeNoActionResults(),
		});

		expect(trace.enforcementAction).toBe("none");
		expect(trace.reasoning).toContain("All 4 rules passed");
		expect(trace.reasoning).toContain("Risk score 0 (healthy)");
		expect(trace.reasoning).toContain("No action taken");
		expect(trace.actionTarget).toBeUndefined();
		expect(trace.actionResult).toBeUndefined();
		expect(trace.id).toBeDefined();
		expect(trace.playbookId).toBe("btc-ema");
	});

	it("asset_drift violation in enforce mode — action succeeded", () => {
		const drifts: DriftResult[] = [
			{
				ruleId: "asset-drift",
				ruleName: "Asset Drift",
				contractField: "allowedSymbols",
				result: "violation",
				observedValue: "ETHUSDT",
				contractBound: "BTCUSDT",
				severity: 1,
			},
			{
				ruleId: "oversize",
				ruleName: "Oversize",
				contractField: "marginBudget",
				result: "pass",
				observedValue: 50,
				contractBound: 100,
				severity: 0,
			},
			{
				ruleId: "drawdown-breach",
				ruleName: "Drawdown Breach",
				contractField: "maxDrawdownPct",
				result: "pass",
				observedValue: 2.5,
				contractBound: 6.84,
				severity: 0,
			},
			{
				ruleId: "sharpe-degradation",
				ruleName: "Sharpe Degradation",
				contractField: "backTestSharpe",
				result: "pass",
				observedValue: 1.2,
				contractBound: 1.5,
				severity: 0,
			},
		];

		const actionResults: ActionResult[] = [
			{
				success: true,
				action: {
					type: "cancel_order",
					orderId: "abc123",
					symbol: "ETHUSDT",
					reason: "asset drift",
				},
			},
		];

		const trace = buildTrace({
			playbookId: "btc-ema",
			cycleId: "cycle-2",
			liveState: SAMPLE_LIVE_STATE,
			contract: SAMPLE_CONTRACT,
			driftResults: drifts,
			riskScore: 25,
			riskState: "elevated",
			actionResults,
		});

		expect(trace.enforcementAction).toBe("cancel_order");
		expect(trace.actionTarget).toBe("abc123");
		expect(trace.actionResult).toBe("success");
		expect(trace.actionError).toBeUndefined();
		expect(trace.reasoning).toContain("asset_drift");
		expect(trace.reasoning).toContain("ETHUSDT");
		expect(trace.reasoning).toContain("cancelled order abc123");
	});

	it("drawdown_breach violation in observe mode — no action taken", () => {
		const drifts: DriftResult[] = [
			{
				ruleId: "asset-drift",
				ruleName: "Asset Drift",
				contractField: "allowedSymbols",
				result: "pass",
				observedValue: "none",
				contractBound: "BTCUSDT",
				severity: 0,
			},
			{
				ruleId: "oversize",
				ruleName: "Oversize",
				contractField: "marginBudget",
				result: "pass",
				observedValue: 50,
				contractBound: 100,
				severity: 0,
			},
			{
				ruleId: "drawdown-breach",
				ruleName: "Drawdown Breach",
				contractField: "maxDrawdownPct",
				result: "violation",
				observedValue: 8.5,
				contractBound: 6.84,
				severity: 1,
			},
			{
				ruleId: "sharpe-degradation",
				ruleName: "Sharpe Degradation",
				contractField: "backTestSharpe",
				result: "pass",
				observedValue: 1.2,
				contractBound: 1.5,
				severity: 0,
			},
		];

		const actionResults: ActionResult[] = [
			{ success: true, action: { type: "none", reason: "observe mode" } },
		];

		const trace = buildTrace({
			playbookId: "btc-ema",
			cycleId: "cycle-3",
			liveState: SAMPLE_LIVE_STATE,
			contract: SAMPLE_CONTRACT,
			driftResults: drifts,
			riskScore: 40,
			riskState: "elevated",
			actionResults,
		});

		expect(trace.enforcementAction).toBe("none");
		expect(trace.reasoning).toContain("drawdown_breach");
		expect(trace.reasoning).toContain("8.5%");
		expect(trace.reasoning).toContain("6.84%");
		expect(trace.reasoning).toContain("no action taken");
	});

	it("multiple violations — reasoning mentions count", () => {
		const drifts: DriftResult[] = [
			{
				ruleId: "asset-drift",
				ruleName: "Asset Drift",
				contractField: "allowedSymbols",
				result: "violation",
				observedValue: "ETHUSDT",
				contractBound: "BTCUSDT",
				severity: 1,
			},
			{
				ruleId: "oversize",
				ruleName: "Oversize",
				contractField: "marginBudget",
				result: "pass",
				observedValue: 50,
				contractBound: 100,
				severity: 0,
			},
			{
				ruleId: "drawdown-breach",
				ruleName: "Drawdown Breach",
				contractField: "maxDrawdownPct",
				result: "violation",
				observedValue: 8.5,
				contractBound: 6.84,
				severity: 1,
			},
			{
				ruleId: "sharpe-degradation",
				ruleName: "Sharpe Degradation",
				contractField: "backTestSharpe",
				result: "pass",
				observedValue: 1.2,
				contractBound: 1.5,
				severity: 0,
			},
		];

		const actionResults: ActionResult[] = [
			{
				success: true,
				action: {
					type: "cancel_order",
					orderId: "ord-1",
					symbol: "ETHUSDT",
					reason: "asset drift",
				},
			},
			{
				success: true,
				action: {
					type: "close_position",
					symbol: "BTCUSDT",
					holdSide: "long",
					size: "0.1",
					reason: "drawdown breach",
				},
			},
		];

		const trace = buildTrace({
			playbookId: "btc-ema",
			cycleId: "cycle-4",
			liveState: SAMPLE_LIVE_STATE,
			contract: SAMPLE_CONTRACT,
			driftResults: drifts,
			riskScore: 72,
			riskState: "critical",
			actionResults,
		});

		expect(trace.reasoning).toContain("2 violations");
		expect(trace.reasoning).toContain("asset_drift");
		expect(trace.reasoning).toContain("drawdown_breach");
		expect(trace.reasoning).toContain("cancelled 1 order");
		expect(trace.reasoning).toContain("closed 1 position");
		expect(trace.enforcementAction).toBe("cancel_order");
		expect(trace.actionTarget).toBe("ord-1");
	});
});
