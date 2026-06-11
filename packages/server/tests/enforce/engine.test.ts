import type { DriftResult, LiveState } from "@zenithpulse/shared";
import { describe, expect, it } from "vitest";
import { decideEnforcement } from "../../src/enforce/engine.js";

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

function makeViolation(ruleId: string): DriftResult {
	return {
		ruleId,
		ruleName: ruleId,
		contractField: "test",
		result: "violation",
		observedValue: 1,
		contractBound: 0,
		severity: 1,
	};
}

function makeWarn(ruleId: string): DriftResult {
	return {
		ruleId,
		ruleName: ruleId,
		contractField: "test",
		result: "warn",
		observedValue: 1,
		contractBound: 0,
		severity: 0.5,
	};
}

describe("decideEnforcement", () => {
	it("observe mode + violation -> none action", () => {
		const state = makeLiveState();
		const plan = decideEnforcement("observe", [makeViolation("asset-drift")], state);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].type).toBe("none");
		expect(plan.mode).toBe("observe");
	});

	it("silent mode + violation -> none action", () => {
		const state = makeLiveState();
		const plan = decideEnforcement("silent", [makeViolation("drawdown-breach")], state);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].type).toBe("none");
		expect(plan.mode).toBe("silent");
	});

	it("enforce mode + no violations -> none action", () => {
		const pass: DriftResult = {
			ruleId: "asset-drift",
			ruleName: "Asset Drift",
			contractField: "allowedSymbols",
			result: "pass",
			observedValue: "none",
			contractBound: "BTCUSDT",
			severity: 0,
		};
		const state = makeLiveState();
		const plan = decideEnforcement("enforce", [pass], state);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].type).toBe("none");
		if (plan.actions[0].type === "none") {
			expect(plan.actions[0].reason).toBe("no violations");
		}
	});

	it("enforce mode + asset_drift violation -> cancel_order actions for open orders", () => {
		const state = makeLiveState({
			openOrders: [
				{
					orderId: "ord-1",
					symbol: "DOGEUSDT",
					side: "buy",
					orderType: "limit",
					price: "0.1",
					size: "1000",
					status: "open",
					createTime: "123",
				},
				{
					orderId: "ord-2",
					symbol: "SOLUSDT",
					side: "buy",
					orderType: "limit",
					price: "100",
					size: "5",
					status: "open",
					createTime: "456",
				},
			],
		});
		const plan = decideEnforcement("enforce", [makeViolation("asset-drift")], state);
		expect(plan.actions).toHaveLength(2);
		expect(plan.actions[0].type).toBe("cancel_order");
		if (plan.actions[0].type === "cancel_order") {
			expect(plan.actions[0].orderId).toBe("ord-1");
			expect(plan.actions[0].symbol).toBe("DOGEUSDT");
		}
		if (plan.actions[1].type === "cancel_order") {
			expect(plan.actions[1].orderId).toBe("ord-2");
			expect(plan.actions[1].symbol).toBe("SOLUSDT");
		}
	});

	it("enforce mode + drawdown_breach violation -> close_position actions", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "BTCUSDT",
					holdSide: "long",
					total: "0.1",
					available: "0.1",
					averageOpenPrice: "50000",
					unrealizedPL: "-500",
					marginSize: "500",
					leverage: "10",
				},
				{
					symbol: "ETHUSDT",
					holdSide: "short",
					total: "2",
					available: "2",
					averageOpenPrice: "3000",
					unrealizedPL: "-200",
					marginSize: "600",
					leverage: "10",
				},
			],
		});
		const plan = decideEnforcement("enforce", [makeViolation("drawdown-breach")], state);
		expect(plan.actions).toHaveLength(2);
		expect(plan.actions[0].type).toBe("close_position");
		if (plan.actions[0].type === "close_position") {
			expect(plan.actions[0].symbol).toBe("BTCUSDT");
			expect(plan.actions[0].holdSide).toBe("long");
			expect(plan.actions[0].size).toBe("0.1");
		}
		if (plan.actions[1].type === "close_position") {
			expect(plan.actions[1].symbol).toBe("ETHUSDT");
			expect(plan.actions[1].holdSide).toBe("short");
			expect(plan.actions[1].size).toBe("2");
		}
	});

	it("enforce mode + sharpe_degradation warn -> none action", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "BTCUSDT",
					holdSide: "long",
					total: "0.1",
					available: "0.1",
					averageOpenPrice: "50000",
					unrealizedPL: "0",
					marginSize: "500",
					leverage: "10",
				},
			],
		});
		const plan = decideEnforcement("enforce", [makeWarn("sharpe-degradation")], state);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].type).toBe("none");
	});

	it("enforce mode + oversize violation -> close largest position", () => {
		const state = makeLiveState({
			positions: [
				{
					symbol: "BTCUSDT",
					holdSide: "long",
					total: "0.1",
					available: "0.1",
					averageOpenPrice: "50000",
					unrealizedPL: "0",
					marginSize: "500",
					leverage: "10",
				},
				{
					symbol: "ETHUSDT",
					holdSide: "long",
					total: "5",
					available: "5",
					averageOpenPrice: "3000",
					unrealizedPL: "0",
					marginSize: "1500",
					leverage: "10",
				},
			],
		});
		const plan = decideEnforcement("enforce", [makeViolation("oversize")], state);
		expect(plan.actions).toHaveLength(1);
		expect(plan.actions[0].type).toBe("close_position");
		if (plan.actions[0].type === "close_position") {
			expect(plan.actions[0].symbol).toBe("ETHUSDT");
			expect(plan.actions[0].size).toBe("5");
		}
	});
});
