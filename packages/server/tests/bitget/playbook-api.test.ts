import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPlaybookClient } from "../../src/bitget/playbook-api.js";

const baseConfig = {
	BITGET_API_KEY: "test-key",
	BITGET_SECRET_KEY: "test-secret",
	BITGET_PASSPHRASE: "test-passphrase",
	DB_PATH: "./data/test.db",
	PORT: 3001,
	POLL_INTERVAL_MS: 15000,
	MODE_DEFAULT: "observe" as const,
	PAPER_TRADING: false,
	PLAYBOOK_ACCESS_KEY: undefined as string | undefined,
	PLAYBOOK_MARGIN_BUDGET: 100,
	TELEGRAM_BOT_TOKEN: undefined,
	TELEGRAM_CHAT_ID: undefined,
	ZENITHPULSE_API_KEY: undefined,
	ALLOWED_ORIGINS: "http://localhost:3000",
};

describe("PlaybookClient", () => {
	describe("when PLAYBOOK_ACCESS_KEY is not set", () => {
		const client = createPlaybookClient(baseConfig);

		it("listPlaybooks returns mock data", async () => {
			const playbooks = await client.listPlaybooks();
			expect(playbooks).toHaveLength(1);
			expect(playbooks[0].strategy_id).toBe("btc-ema-cross-demo");
			expect(playbooks[0].name).toBe("BTC EMA Cross Demo");
			expect(playbooks[0].trading_symbols).toEqual(["BTCUSDT"]);
			expect(playbooks[0].official_metrics.max_drawdown_pct).toBe(12.5);
			expect(playbooks[0].official_metrics.sharpe_ratio).toBe(1.8);
			expect(playbooks[0].official_metrics.margin_budget).toBe(1000);
			expect(playbooks[0].execution_mode).toBe("follow_trade");
		});

		it("getPlaybookRun returns mock data", async () => {
			const run = await client.getPlaybookRun("any-id");
			expect(run.run_id).toBe("run-demo-001");
			expect(run.strategy_id).toBe("btc-ema-cross-demo");
			expect(run.status).toBe("running");
		});
	});

	describe("when PLAYBOOK_ACCESS_KEY is set", () => {
		const mockFetch = vi.fn();

		beforeEach(() => {
			vi.stubGlobal("fetch", mockFetch);
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		const configWithKey = { ...baseConfig, PLAYBOOK_ACCESS_KEY: "test-access-key" };
		const client = createPlaybookClient(configWithKey);

		it("listPlaybooks fetches from API with ACCESS-KEY header", async () => {
			const mockResponse = {
				code: "00000",
				data: {
					items: [
						{
							strategy_id: "live-strategy",
							name: "Live Strategy",
							trading_symbols: ["ETHUSDT"],
							official_metrics: {
								summary: {
									max_drawdown_pct: 8.0,
									sharpe_ratio: 2.1,
									total_return_pct: 60.0,
									total_trades: 200,
									margin_budget: 500,
								},
							},
							execution_mode: "follow_trade",
						},
					],
				},
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const playbooks = await client.listPlaybooks();
			expect(playbooks).toHaveLength(1);
			expect(playbooks[0].strategy_id).toBe("live-strategy");

			expect(mockFetch).toHaveBeenCalledWith(
				"https://api.bitget.com/api/v1/playbook/list",
				expect.objectContaining({
					headers: expect.objectContaining({
						"ACCESS-KEY": "test-access-key",
					}),
				}),
			);
		});

		it("getPlaybookRun fetches from API", async () => {
			const mockResponse = {
				run_id: "run-live-001",
				strategy_id: "live-strategy",
				name: "Live Strategy",
				status: "running",
				trading_symbols: ["ETHUSDT"],
				official_metrics: {
					summary: {
						max_drawdown_pct: 8.0,
						sharpe_ratio: 2.1,
						total_return_pct: 60.0,
						total_trades: 200,
						margin_budget: 500,
					},
				},
				execution_mode: "follow_trade",
			};

			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockResponse),
			});

			const run = await client.getPlaybookRun("run-live-001");
			expect(run.run_id).toBe("run-live-001");
		});

		it("throws on API error", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
			});

			await expect(client.listPlaybooks()).rejects.toThrow("Playbook API error: 401");
		});

		it("throws on invalid response shape", async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ invalid: "data" }),
			});

			await expect(client.listPlaybooks()).rejects.toThrow();
		});
	});
});
