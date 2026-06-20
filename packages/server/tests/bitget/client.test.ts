import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "../../src/config.js";

const mockPrivateGet = vi.fn();
const mockPrivatePost = vi.fn();

vi.mock("bitget-core", () => ({
	BitgetRestClient: vi.fn().mockImplementation(() => ({
		privateGet: mockPrivateGet,
		privatePost: mockPrivatePost,
	})),
}));

const { createBitgetClient } = await import("../../src/bitget/client.js");

const config: AppConfig = {
	BITGET_API_KEY: "test-key",
	BITGET_SECRET_KEY: "test-secret",
	BITGET_PASSPHRASE: "test-passphrase",
	DB_PATH: "./data/test.db",
	PORT: 3001,
	POLL_INTERVAL_MS: 15000,
	MODE_DEFAULT: "observe",
	PAPER_TRADING: false,
	PLAYBOOK_ACCESS_KEY: undefined,
	PLAYBOOK_MARGIN_BUDGET: 100,
	TELEGRAM_BOT_TOKEN: undefined,
	TELEGRAM_CHAT_ID: undefined,
	ZENITHPULSE_API_KEY: undefined,
	ALLOWED_ORIGINS: "http://localhost:3000",
};

describe("BitgetClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	const client = createBitgetClient(config);

	describe("getFuturesPositions", () => {
		it("returns typed positions array", async () => {
			mockPrivateGet.mockResolvedValue({
				data: [
					{
						symbol: "BTCUSDT",
						holdSide: "long",
						total: "0.1",
						available: "0.1",
						averageOpenPrice: "65000",
						unrealizedPL: "120.5",
						marginSize: "650",
						leverage: "10",
					},
				],
			});

			const positions = await client.getFuturesPositions("USDT-FUTURES");
			expect(positions).toHaveLength(1);
			expect(positions[0]).toEqual({
				symbol: "BTCUSDT",
				holdSide: "long",
				total: "0.1",
				available: "0.1",
				averageOpenPrice: "65000",
				unrealizedPL: "120.5",
				marginSize: "650",
				leverage: "10",
			});
		});

		it("returns empty array when no positions", async () => {
			mockPrivateGet.mockResolvedValue({ data: [] });
			const positions = await client.getFuturesPositions("USDT-FUTURES");
			expect(positions).toEqual([]);
		});
	});

	describe("getOpenOrders", () => {
		it("returns typed orders array", async () => {
			mockPrivateGet.mockResolvedValue({
				data: {
					entrustedList: [
						{
							orderId: "order-1",
							symbol: "BTCUSDT",
							side: "buy",
							orderType: "limit",
							price: "60000",
							size: "0.01",
							status: "new",
							cTime: "1700000000000",
						},
					],
				},
			});

			const orders = await client.getOpenOrders("BTCUSDT");
			expect(orders).toHaveLength(1);
			expect(orders[0]).toEqual({
				orderId: "order-1",
				symbol: "BTCUSDT",
				side: "buy",
				orderType: "limit",
				price: "60000",
				size: "0.01",
				status: "new",
				createTime: "1700000000000",
			});
		});
	});

	describe("getPlanOrders", () => {
		it("returns typed plan orders array", async () => {
			mockPrivateGet.mockResolvedValue({
				data: {
					entrustedList: [
						{
							orderId: "plan-1",
							symbol: "ETHUSDT",
							side: "sell",
							planType: "profit_plan",
							triggerPrice: "4000",
							size: "0.5",
							status: "not_trigger",
							cTime: "1700000000000",
						},
					],
				},
			});

			const orders = await client.getPlanOrders();
			expect(orders).toHaveLength(1);
			expect(orders[0].planType).toBe("profit_plan");
		});
	});

	describe("getAccountBalance", () => {
		it("returns USDT balance as number", async () => {
			mockPrivateGet.mockResolvedValue({
				data: [{ marginCoin: "USDT", available: "1000", equity: "1050", usdtEquity: "1050.25" }],
			});

			const balance = await client.getAccountBalance();
			expect(balance).toBe(1050.25);
		});

		it("returns 0 when no USDT asset", async () => {
			mockPrivateGet.mockResolvedValue({ data: [] });
			const balance = await client.getAccountBalance();
			expect(balance).toBe(0);
		});
	});

	describe("cancelFuturesOrder", () => {
		it("cancels and returns success", async () => {
			mockPrivatePost.mockResolvedValue({ data: {} });
			const result = await client.cancelFuturesOrder("BTCUSDT", "order-123");
			expect(result).toEqual({ success: true, orderId: "order-123" });
			expect(mockPrivatePost).toHaveBeenCalledWith("/api/v2/mix/order/cancel-order", {
				productType: "USDT-FUTURES",
				symbol: "BTCUSDT",
				orderId: "order-123",
			});
		});
	});

	describe("closeFuturesPosition", () => {
		it("places close order for long position", async () => {
			mockPrivatePost.mockResolvedValue({ data: { orderId: "close-1" } });
			const result = await client.closeFuturesPosition("BTCUSDT", "long", "0.1");
			expect(result).toEqual({ success: true, orderId: "close-1" });
			expect(mockPrivatePost).toHaveBeenCalledWith(
				"/api/v2/mix/order/place-order",
				expect.objectContaining({
					side: "sell",
					tradeSide: "close",
					orderType: "market",
				}),
			);
		});

		it("places close order for short position", async () => {
			mockPrivatePost.mockResolvedValue({ data: { orderId: "close-2" } });
			const result = await client.closeFuturesPosition("ETHUSDT", "short", "1.0");
			expect(result).toEqual({ success: true, orderId: "close-2" });
			expect(mockPrivatePost).toHaveBeenCalledWith(
				"/api/v2/mix/order/place-order",
				expect.objectContaining({
					side: "buy",
					tradeSide: "close",
				}),
			);
		});
	});
});
