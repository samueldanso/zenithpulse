import type { Order, PlanOrder, Position } from "@zenithpulse/shared";
import { describe, expect, it } from "vitest";
import type { BitgetClient } from "../../src/bitget/client.js";
import { pollLiveState } from "../../src/observer/poller.js";

function createMockBitgetClient(overrides?: Partial<BitgetClient>): BitgetClient {
	return {
		getAccountBalance: async () => 1000,
		getOpenOrders: async () => [],
		getPlanOrders: async () => [],
		getFuturesPositions: async () => [],
		cancelFuturesOrder: async () => ({ success: true, orderId: "123" }),
		cancelPlanOrder: async () => ({ success: true, orderId: "123" }),
		closeFuturesPosition: async () => ({ success: true, orderId: "123" }),
		...overrides,
	};
}

describe("pollLiveState", () => {
	it("assembles LiveState from mocked responses", async () => {
		const orders: Order[] = [
			{
				orderId: "ord-1",
				symbol: "BTCUSDT",
				side: "buy",
				orderType: "limit",
				price: "50000",
				size: "0.1",
				status: "open",
				createTime: "1700000000000",
			},
		];

		const positions: Position[] = [
			{
				symbol: "BTCUSDT",
				holdSide: "long",
				total: "0.5",
				available: "0.5",
				averageOpenPrice: "50000",
				unrealizedPL: "500",
				marginSize: "5000",
				leverage: "10",
			},
		];

		const client = createMockBitgetClient({
			getAccountBalance: async () => 5000,
			getOpenOrders: async () => orders,
			getFuturesPositions: async () => positions,
		});

		const { liveState, newPeak } = await pollLiveState(client, 0);

		expect(liveState.accountBalance).toBe(5000);
		expect(liveState.openOrders).toEqual(orders);
		expect(liveState.positions).toEqual(positions);
		expect(liveState.totalExposure).toBe(30000);
		expect(liveState.currentDrawdown).toBe(0);
		expect(liveState.rollingSharpe).toBe(0);
		expect(liveState.timestamp).toBeTruthy();
		expect(newPeak).toBe(5000);
	});

	it("handles empty account gracefully", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 0,
			getOpenOrders: async () => [],
			getPlanOrders: async () => [],
			getFuturesPositions: async () => [],
		});

		const { liveState } = await pollLiveState(client, 0);

		expect(liveState.accountBalance).toBe(0);
		expect(liveState.openOrders).toEqual([]);
		expect(liveState.openPlanOrders).toEqual([]);
		expect(liveState.positions).toEqual([]);
		expect(liveState.currentDrawdown).toBe(0);
		expect(liveState.totalExposure).toBe(0);
	});

	it("computes drawdown when balance drops from peak", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 900,
		});

		const { liveState } = await pollLiveState(client, 1000);
		expect(liveState.currentDrawdown).toBe(10); // (1000-900)/1000 * 100
	});

	it("updates peak when balance exceeds current peak", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 1500,
		});

		const { newPeak } = await pollLiveState(client, 1000);
		expect(newPeak).toBe(1500);
	});

	it("preserves peak when balance is below current peak", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 800,
		});

		const { newPeak } = await pollLiveState(client, 1000);
		expect(newPeak).toBe(1000);
	});

	it("computes totalExposure from positions", async () => {
		const positions: Position[] = [
			{
				symbol: "BTCUSDT",
				holdSide: "long",
				total: "1.0",
				available: "1.0",
				averageOpenPrice: "60000",
				unrealizedPL: "100",
				marginSize: "6000",
				leverage: "10",
			},
			{
				symbol: "ETHUSDT",
				holdSide: "long",
				total: "10.0",
				available: "10.0",
				averageOpenPrice: "3000",
				unrealizedPL: "50",
				marginSize: "3000",
				leverage: "10",
			},
		];

		const client = createMockBitgetClient({
			getFuturesPositions: async () => positions,
		});

		const { liveState } = await pollLiveState(client, 0);
		expect(liveState.totalExposure).toBe(90000); // 1*60000 + 10*3000
	});
});
