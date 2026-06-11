import type { BehavioralContract } from "@zenithpulse/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockValues = vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ run: mockRun })) }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockWhere = vi.fn(() => ({ get: mockGet }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

vi.mock("../../src/db/schema.js", () => ({
	playbooks: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field, value) => ({ field, value })),
}));

const SAMPLE_CONTRACT: BehavioralContract = {
	playbookId: "btc-ema-cross",
	derivedAt: "2026-06-10T12:00:00.000Z",
	allowedSymbols: ["BTCUSDT"],
	maxDrawdownPct: 12.5,
	backTestSharpe: 1.8,
	marginBudget: 100,
	executionMode: "follow_trade",
	expectedReturnPct: 45.2,
	totalTrades: 142,
};

describe("contract store", () => {
	let db: { insert: typeof mockInsert; select: typeof mockSelect };

	beforeEach(() => {
		vi.clearAllMocks();
		db = { insert: mockInsert, select: mockSelect };
	});

	it("saveContract calls insert with correct values", async () => {
		const { saveContract } = await import("../../src/contract/store.js");
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		saveContract(db as any, "btc-ema-cross", "BTC EMA Cross", SAMPLE_CONTRACT);
		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "btc-ema-cross",
				name: "BTC EMA Cross",
				contractJson: JSON.stringify(SAMPLE_CONTRACT),
				contractDerivedAt: SAMPLE_CONTRACT.derivedAt,
			}),
		);
	});

	it("loadContract returns deserialized contract when found", async () => {
		mockGet.mockReturnValue({ contractJson: JSON.stringify(SAMPLE_CONTRACT) });
		const { loadContract } = await import("../../src/contract/store.js");
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		const result = loadContract(db as any, "btc-ema-cross");
		expect(result).toEqual(SAMPLE_CONTRACT);
	});

	it("loadContract returns null for unknown ID", async () => {
		mockGet.mockReturnValue(undefined);
		const { loadContract } = await import("../../src/contract/store.js");
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		const result = loadContract(db as any, "nonexistent");
		expect(result).toBeNull();
	});

	it("loadContract returns null when row has no contractJson", async () => {
		mockGet.mockReturnValue({ contractJson: null });
		const { loadContract } = await import("../../src/contract/store.js");
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		const result = loadContract(db as any, "btc-ema-cross");
		expect(result).toBeNull();
	});
});
