import { describe, expect, it, vi } from "vitest";
import type { BitgetClient } from "../../src/bitget/client.js";
import { executeEnforcement } from "../../src/enforce/actions.js";
import type { EnforcementPlan } from "../../src/enforce/types.js";

function createMockBitgetClient(): BitgetClient {
	return {
		getAccountBalance: vi.fn(async () => 1000),
		getOpenOrders: vi.fn(async () => []),
		getPlanOrders: vi.fn(async () => []),
		getFuturesPositions: vi.fn(async () => []),
		cancelFuturesOrder: vi.fn(async () => ({ success: true, orderId: "123" })),
		cancelPlanOrder: vi.fn(async () => ({ success: true, orderId: "123" })),
		closeFuturesPosition: vi.fn(async () => ({ success: true, orderId: "456" })),
	};
}

describe("executeEnforcement", () => {
	it("none action -> success true, no API call made", async () => {
		const client = createMockBitgetClient();
		const plan: EnforcementPlan = {
			actions: [{ type: "none", reason: "no violations" }],
			mode: "enforce",
		};

		const results = await executeEnforcement(plan, client);

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(results[0].action.type).toBe("none");
		expect(client.cancelFuturesOrder).not.toHaveBeenCalled();
		expect(client.closeFuturesPosition).not.toHaveBeenCalled();
	});

	it("cancel_order -> correct API call params, success result returned", async () => {
		const client = createMockBitgetClient();
		const plan: EnforcementPlan = {
			actions: [
				{
					type: "cancel_order",
					orderId: "ord-99",
					symbol: "DOGEUSDT",
					reason: "asset-drift",
				},
			],
			mode: "enforce",
		};

		const results = await executeEnforcement(plan, client);

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(client.cancelFuturesOrder).toHaveBeenCalledWith("DOGEUSDT", "ord-99");
	});

	it("close_position -> correct API call, success result", async () => {
		const client = createMockBitgetClient();
		const plan: EnforcementPlan = {
			actions: [
				{
					type: "close_position",
					symbol: "BTCUSDT",
					holdSide: "long",
					size: "0.5",
					reason: "drawdown-breach",
				},
			],
			mode: "enforce",
		};

		const results = await executeEnforcement(plan, client);

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(client.closeFuturesPosition).toHaveBeenCalledWith("BTCUSDT", "long", "0.5");
	});

	it("API error -> success: false, error message captured, no throw", async () => {
		const client = createMockBitgetClient();
		(client.cancelFuturesOrder as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
			new Error("API rate limit exceeded"),
		);

		const plan: EnforcementPlan = {
			actions: [
				{
					type: "cancel_order",
					orderId: "ord-1",
					symbol: "BTCUSDT",
					reason: "asset-drift",
				},
			],
			mode: "enforce",
		};

		const results = await executeEnforcement(plan, client);

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(false);
		expect(results[0].error).toBe("API rate limit exceeded");
	});

	it("cancel_plan_order -> correct API call params", async () => {
		const client = createMockBitgetClient();
		const plan: EnforcementPlan = {
			actions: [
				{
					type: "cancel_plan_order",
					orderId: "plan-1",
					symbol: "ETHUSDT",
					reason: "asset-drift",
				},
			],
			mode: "enforce",
		};

		const results = await executeEnforcement(plan, client);

		expect(results).toHaveLength(1);
		expect(results[0].success).toBe(true);
		expect(client.cancelPlanOrder).toHaveBeenCalledWith("ETHUSDT", "plan-1");
	});
});
