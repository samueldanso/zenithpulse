import type { BehavioralContract, LiveState } from "@zenithpulse/shared";
import { describe, expect, it } from "vitest";
import {
	detectAssetDrift,
	detectDrawdownBreach,
	detectOversize,
	detectSharpeDegradation,
} from "../../src/drift/detect.js";

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

describe("detectAssetDrift", () => {
	it("returns pass when all symbols are allowed", () => {
		const state = makeLiveState({
			openOrders: [
				{
					orderId: "1",
					symbol: "BTCUSDT",
					side: "buy",
					orderType: "limit",
					price: "50000",
					size: "0.1",
					status: "open",
					createTime: "123",
				},
			],
			positions: [
				{
					symbol: "ETHUSDT",
					holdSide: "long",
					total: "1",
					available: "1",
					averageOpenPrice: "3000",
					unrealizedPL: "10",
					marginSize: "100",
					leverage: "10",
				},
			],
		});
		const result = detectAssetDrift(makeContract(), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns violation when order has unauthorized symbol", () => {
		const state = makeLiveState({
			openOrders: [
				{
					orderId: "1",
					symbol: "DOGEUSDT",
					side: "buy",
					orderType: "limit",
					price: "0.1",
					size: "1000",
					status: "open",
					createTime: "123",
				},
			],
		});
		const result = detectAssetDrift(makeContract(), state);
		expect(result.result).toBe("violation");
		expect(result.severity).toBe(1);
		expect(result.observedValue).toBe("DOGEUSDT");
	});

	it("returns violation when position has unauthorized symbol", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "SOLUSDT",
					holdSide: "long",
					total: "5",
					available: "5",
					averageOpenPrice: "100",
					unrealizedPL: "0",
					marginSize: "50",
					leverage: "10",
				},
			],
		});
		const result = detectAssetDrift(makeContract(), state);
		expect(result.result).toBe("violation");
		expect(result.severity).toBe(1);
		expect(result.observedValue).toBe("SOLUSDT");
	});

	it("returns pass when no orders or positions exist", () => {
		const result = detectAssetDrift(makeContract(), makeLiveState());
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("deduplicates symbols across orders and positions", () => {
		const state = makeLiveState({
			openOrders: [
				{
					orderId: "1",
					symbol: "DOGEUSDT",
					side: "buy",
					orderType: "limit",
					price: "0.1",
					size: "1000",
					status: "open",
					createTime: "123",
				},
			],
			positions: [
				{
					symbol: "DOGEUSDT",
					holdSide: "long",
					total: "5",
					available: "5",
					averageOpenPrice: "0.1",
					unrealizedPL: "0",
					marginSize: "50",
					leverage: "10",
				},
			],
		});
		const result = detectAssetDrift(makeContract(), state);
		expect(result.result).toBe("violation");
		expect(result.observedValue).toBe("DOGEUSDT");
	});
});

describe("detectOversize", () => {
	it("returns pass when exposure is within budget", () => {
		const state = makeLiveState({ totalExposure: 800 });
		const result = detectOversize(makeContract(), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns pass when exposure equals budget", () => {
		const state = makeLiveState({ totalExposure: 1000 });
		const result = detectOversize(makeContract(), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns violation when exposure exceeds budget", () => {
		const state = makeLiveState({ totalExposure: 1500 });
		const result = detectOversize(makeContract(), state);
		expect(result.result).toBe("violation");
		expect(result.severity).toBe(0.5);
	});

	it("caps severity at 1 for extreme oversize", () => {
		const state = makeLiveState({ totalExposure: 3000 });
		const result = detectOversize(makeContract(), state);
		expect(result.result).toBe("violation");
		expect(result.severity).toBe(1);
	});

	it("returns pass when exposure is 0", () => {
		const result = detectOversize(makeContract(), makeLiveState());
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});
});

describe("detectDrawdownBreach", () => {
	it("returns pass when drawdown is within limit", () => {
		const state = makeLiveState({ currentDrawdown: 5 });
		const result = detectDrawdownBreach(makeContract(), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns pass when drawdown equals limit", () => {
		const state = makeLiveState({ currentDrawdown: 10 });
		const result = detectDrawdownBreach(makeContract(), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns violation when drawdown exceeds limit", () => {
		const state = makeLiveState({ currentDrawdown: 12 });
		const result = detectDrawdownBreach(makeContract({ maxDrawdownPct: 10 }), state);
		expect(result.result).toBe("violation");
		expect(result.severity).toBeCloseTo(1, 1);
	});

	it("returns pass when drawdown is 0", () => {
		const result = detectDrawdownBreach(makeContract(), makeLiveState());
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});
});

describe("detectSharpeDegradation", () => {
	it("returns pass when rolling sharpe exceeds backtest sharpe", () => {
		const state = makeLiveState({ rollingSharpe: 2.0 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 1.5 }), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns warn when rolling sharpe is below backtest sharpe", () => {
		const state = makeLiveState({ rollingSharpe: 0.9 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 1.5 }), state);
		expect(result.result).toBe("warn");
		expect(result.severity).toBeCloseTo(0.4, 1);
	});

	it("returns pass when rolling sharpe is 0 (no data)", () => {
		const state = makeLiveState({ rollingSharpe: 0 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 1.5 }), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns pass when backtest sharpe is 0", () => {
		const state = makeLiveState({ rollingSharpe: 1.0 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 0 }), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns pass when both sharpe values are 0", () => {
		const state = makeLiveState({ rollingSharpe: 0 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 0 }), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});

	it("returns pass when rolling sharpe equals backtest sharpe", () => {
		const state = makeLiveState({ rollingSharpe: 1.5 });
		const result = detectSharpeDegradation(makeContract({ backTestSharpe: 1.5 }), state);
		expect(result.result).toBe("pass");
		expect(result.severity).toBe(0);
	});
});
