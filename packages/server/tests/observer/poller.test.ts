import type { Order, PlanOrder, Position } from "@zenithpulse/shared";
import { beforeEach, describe, expect, it } from "vitest";
import type { BitgetClient } from "../../src/bitget/client.js";
import { pollLiveState, resetPeakBalance } from "../../src/observer/poller.js";

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
	beforeEach(() => {
		resetPeakBalance();
	});

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

		const state = await pollLiveState(client);

		expect(state.accountBalance).toBe(5000);
		expect(state.openOrders).toEqual(orders);
		expect(state.positions).toEqual(positions);
		expect(state.totalExposure).toBe(30000); // positions: 0.5*50000=25000 + order: 0.1*50000=5000
		expect(state.currentDrawdown).toBe(0); // first poll, balance is peak
		expect(state.rollingSharpe).toBe(0);
		expect(state.timestamp).toBeTruthy();
	});

	it("handles empty account gracefully", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 0,
			getOpenOrders: async () => [],
			getPlanOrders: async () => [],
			getFuturesPositions: async () => [],
		});

		const state = await pollLiveState(client);

		expect(state.accountBalance).toBe(0);
		expect(state.openOrders).toEqual([]);
		expect(state.openPlanOrders).toEqual([]);
		expect(state.positions).toEqual([]);
		expect(state.currentDrawdown).toBe(0);
		expect(state.totalExposure).toBe(0);
	});

	it("computes drawdown when balance drops from peak", async () => {
		const client = createMockBitgetClient({
			getAccountBalance: async () => 1000,
		});

		await pollLiveState(client); // sets peak to 1000

		const droppedClient = createMockBitgetClient({
			getAccountBalance: async () => 900,
		});

		const state = await pollLiveState(droppedClient);
		expect(state.currentDrawdown).toBe(10); // (1000-900)/1000 * 100
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

		const state = await pollLiveState(client);
		expect(state.totalExposure).toBe(90000); // 1*60000 + 10*3000
	});
});
