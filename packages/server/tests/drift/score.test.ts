import type { BehavioralContract, LiveState } from "@zenithpulse/shared";
import { describe, expect, it } from "vitest";
import { computeRiskFactors, computeRiskScore, getRiskState } from "../../src/drift/score.js";

function makeContract(overrides?: Partial<BehavioralContract>): BehavioralContract {
	return {
		playbookId: "test-pb",
		derivedAt: "2026-06-01T00:00:00.000Z",
		allowedSymbols: ["BTCUSDT", "ETHUSDT"],
		maxDrawdownPct: 10,
		backTestSharpe: 1.5,
		marginBudget: 1000,
		executionMode: "follow_trade",
		expectedReturnPct: 30,
		totalTrades: 100,
		...overrides,
	};
}

function makeLiveState(overrides?: Partial<LiveState>): LiveState {
	return {
		timestamp: "2026-06-11T12:00:00.000Z",
		accountBalance: 1000,
		openOrders: [],
		openPlanOrders: [],
		positions: [],
		currentDrawdown: 0,
		totalExposure: 0,
		rollingSharpe: 0,
		...overrides,
	};
}

describe("computeRiskFactors", () => {
	it("returns all zeros when state is clean", () => {
		const factors = computeRiskFactors(makeContract(), makeLiveState());
		expect(factors.drawdownProximity).toBe(0);
		expect(factors.assetDriftCount).toBe(0);
		expect(factors.oversizeRatio).toBe(0);
		expect(factors.sharpeDegradation).toBe(0);
	});

	it("computes drawdown proximity as ratio to max", () => {
		const state = makeLiveState({ currentDrawdown: 5 });
		const factors = computeRiskFactors(makeContract({ maxDrawdownPct: 10 }), state);
		expect(factors.drawdownProximity).toBeCloseTo(0.5);
	});

	it("counts unauthorized positions and orders as asset drift", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "DOGEUSDT",
					holdSide: "long",
					total: "1",
					available: "1",
					averageOpenPrice: "0.1",
					unrealizedPL: "0",
					marginSize: "10",
					leverage: "10",
				},
			],
			openOrders: [
				{
					orderId: "1",
					symbol: "SOLUSDT",
					side: "buy",
					orderType: "limit",
					price: "100",
					size: "1",
					status: "open",
					createTime: "123",
				},
			],
		});
		const factors = computeRiskFactors(makeContract(), state);
		expect(factors.assetDriftCount).toBe(2);
	});

	it("computes oversize ratio as excess over budget", () => {
		const state = makeLiveState({ totalExposure: 1500 });
		const factors = computeRiskFactors(makeContract({ marginBudget: 1000 }), state);
		expect(factors.oversizeRatio).toBeCloseTo(0.5);
	});

	it("computes sharpe degradation correctly", () => {
		const state = makeLiveState({ rollingSharpe: 0.75 });
		const factors = computeRiskFactors(makeContract({ backTestSharpe: 1.5 }), state);
		expect(factors.sharpeDegradation).toBeCloseTo(0.5);
	});
});

describe("computeRiskScore", () => {
	it("returns 0 when all rules pass (no drift)", () => {
		const score = computeRiskScore(makeContract(), makeLiveState());
		expect(score).toBe(0);
	});

	it("returns 25 when one asset drifts but nothing else", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "DOGEUSDT",
					holdSide: "long",
					total: "1",
					available: "1",
					averageOpenPrice: "0.1",
					unrealizedPL: "0",
					marginSize: "10",
					leverage: "10",
				},
			],
		});
		const score = computeRiskScore(makeContract(), state);
		expect(score).toBe(25);
	});

	it("returns 40 when drawdown is at 100% of max", () => {
		const state = makeLiveState({ currentDrawdown: 10 });
		const score = computeRiskScore(makeContract({ maxDrawdownPct: 10 }), state);
		expect(score).toBe(40);
	});

	it("returns 20 when exposure is 2x budget (oversizeRatio=1)", () => {
		const state = makeLiveState({ totalExposure: 2000 });
		const score = computeRiskScore(makeContract({ marginBudget: 1000 }), state);
		expect(score).toBe(20);
	});

	it("caps at 100 for extreme values", () => {
		const state = makeLiveState({ currentDrawdown: 30 });
		const score = computeRiskScore(makeContract({ maxDrawdownPct: 10 }), state);
		expect(score).toBe(100);
	});

	it("uses max of all weighted factors", () => {
		const state = makeLiveState({
			currentDrawdown: 5,
			totalExposure: 1500,
			positions: [
				{
					symbol: "DOGEUSDT",
					holdSide: "long",
					total: "1",
					available: "1",
					averageOpenPrice: "0.1",
					unrealizedPL: "0",
					marginSize: "10",
					leverage: "10",
				},
			],
		});
		const score = computeRiskScore(makeContract({ maxDrawdownPct: 10, marginBudget: 1000 }), state);
		expect(score).toBe(25);
	});
});

describe("getRiskState", () => {
	it("returns healthy for score 0", () => {
		expect(getRiskState(0)).toBe("healthy");
	});

	it("returns healthy for score 39", () => {
		expect(getRiskState(39)).toBe("healthy");
	});

	it("returns elevated for score 40", () => {
		expect(getRiskState(40)).toBe("elevated");
	});

	it("returns elevated for score 69", () => {
		expect(getRiskState(69)).toBe("elevated");
	});

	it("returns critical for score 70", () => {
		expect(getRiskState(70)).toBe("critical");
	});

	it("returns critical for score 100", () => {
		expect(getRiskState(100)).toBe("critical");
	});
});
