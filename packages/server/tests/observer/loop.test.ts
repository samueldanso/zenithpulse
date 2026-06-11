import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BitgetClient } from "../../src/bitget/client.js";
import type { PlaybookClient } from "../../src/bitget/playbook-api.js";
import type { AppConfig } from "../../src/config.js";

const MOCK_CONTRACT_JSON = JSON.stringify({
	playbookId: "btc-ema-cross-demo",
	derivedAt: "2026-06-10T12:00:00.000Z",
	allowedSymbols: ["BTCUSDT"],
	maxDrawdownPct: 12.5,
	backTestSharpe: 1.8,
	marginBudget: 100,
	executionMode: "follow_trade",
	expectedReturnPct: 45.2,
	totalTrades: 142,
});

const mockAll = vi.fn(() => [{ id: "btc-ema-cross-demo", contractJson: MOCK_CONTRACT_JSON }]);
const mockFrom = vi.fn(() => ({ all: mockAll }));
const mockDbSelect = vi.fn(() => ({ from: mockFrom }));

const mockInsertRun = vi.fn();
const mockOnConflict = vi.fn(() => ({ run: mockInsertRun }));
const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

const mockWhere = vi.fn(() => ({ get: vi.fn(() => null) }));
const mockSelectFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelectForLoad = vi.fn(() => ({ from: mockSelectFrom }));

const mockDb = {
	select: mockDbSelect,
	insert: mockInsert,
};

vi.mock("../../src/db/schema.js", () => ({
	playbooks: { id: "id" },
}));

vi.mock("../../src/contract/store.js", () => ({
	loadContract: vi.fn(() => null),
	saveContract: vi.fn(),
}));

vi.mock("../../src/contract/derive.js", () => ({
	deriveContract: vi.fn(() => ({
		playbookId: "btc-ema-cross-demo",
		derivedAt: "2026-06-10T12:00:00.000Z",
		allowedSymbols: ["BTCUSDT"],
		maxDrawdownPct: 12.5,
		backTestSharpe: 1.8,
		marginBudget: 100,
		executionMode: "follow_trade",
		expectedReturnPct: 45.2,
		totalTrades: 142,
	})),
}));

vi.mock("../../src/observer/poller.js", () => ({
	pollLiveState: vi.fn(async () => ({
		timestamp: new Date().toISOString(),
		accountBalance: 1000,
		openOrders: [],
		openPlanOrders: [],
		positions: [],
		currentDrawdown: 0,
		totalExposure: 0,
		rollingSharpe: 0,
	})),
}));

function createMockConfig(overrides?: Partial<AppConfig>): AppConfig {
	return {
		BITGET_API_KEY: "test",
		BITGET_SECRET_KEY: "test",
		BITGET_PASSPHRASE: "test",
		DB_PATH: ":memory:",
		PORT: 3001,
		POLL_INTERVAL_MS: 50,
		MODE_DEFAULT: "observe",
		PAPER_TRADING: false,
		PLAYBOOK_MARGIN_BUDGET: 100,
		...overrides,
	};
}

function createMockBitgetClient(): BitgetClient {
	return {
		getAccountBalance: async () => 1000,
		getOpenOrders: async () => [],
		getPlanOrders: async () => [],
		getFuturesPositions: async () => [],
		cancelFuturesOrder: async () => ({ success: true, orderId: "123" }),
		cancelPlanOrder: async () => ({ success: true, orderId: "123" }),
		closeFuturesPosition: async () => ({ success: true, orderId: "123" }),
	};
}

function createMockPlaybookClient(): PlaybookClient {
	return {
		listPlaybooks: async () => [
			{
				strategy_id: "btc-ema-cross-demo",
				name: "BTC EMA Cross Demo",
				trading_symbols: ["BTCUSDT"],
				official_metrics: {
					max_drawdown_pct: 12.5,
					sharpe_ratio: 1.8,
					total_return_pct: 45.2,
					total_trades: 142,
				},
				execution_mode: "follow_trade" as const,
			},
		],
		getPlaybookRun: async () => ({
			run_id: "run-1",
			strategy_id: "btc-ema-cross-demo",
			name: "BTC EMA Cross Demo",
			status: "running",
			trading_symbols: ["BTCUSDT"],
			official_metrics: {
				max_drawdown_pct: 12.5,
				sharpe_ratio: 1.8,
				total_return_pct: 45.2,
				total_trades: 142,
			},
			execution_mode: "follow_trade" as const,
		}),
	};
}

describe("ObserverLoop", () => {
	let logSpy: ReturnType<typeof vi.spyOn>;
	let stopFn: () => void;

	beforeEach(() => {
		logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(async () => {
		if (stopFn) stopFn();
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("starts, runs at least 1 cycle, logs summary, stops cleanly", async () => {
		const { start, stop } = await import("../../src/observer/loop.js");
		stopFn = stop;

		const config = createMockConfig();
		const bitgetClient = createMockBitgetClient();
		const playbookClient = createMockPlaybookClient();

		// biome-ignore lint/suspicious/noExplicitAny: test mock
		start(config, mockDb as any, bitgetClient, playbookClient);

		await new Promise((r) => setTimeout(r, 200));
		stop();

		const cycleLogs = logSpy.mock.calls.filter(
			(call) => typeof call[0] === "string" && call[0].includes("[observer] Cycle"),
		);
		expect(cycleLogs.length).toBeGreaterThanOrEqual(1);
	});

	it("logs stub phases during cycle", async () => {
		const { start, stop } = await import("../../src/observer/loop.js");
		stopFn = stop;

		const config = createMockConfig();
		const bitgetClient = createMockBitgetClient();
		const playbookClient = createMockPlaybookClient();

		// biome-ignore lint/suspicious/noExplicitAny: test mock
		start(config, mockDb as any, bitgetClient, playbookClient);

		await new Promise((r) => setTimeout(r, 200));
		stop();

		const stubLogs = logSpy.mock.calls.filter(
			(call) => typeof call[0] === "string" && call[0].includes("stub:"),
		);
		expect(stubLogs.length).toBeGreaterThanOrEqual(1);
	});
});
