import type { DecisionTrace } from "@zenithpulse/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn((): unknown[] => []);
const mockLimit = vi.fn(() => ({ offset: vi.fn(() => ({ all: mockAll })) }));
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, get: mockGet }));
const mockFrom = vi.fn(() => ({ where: mockWhere, orderBy: mockOrderBy }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockValues = vi.fn(() => ({ run: mockRun }));
const mockInsert = vi.fn(() => ({ values: mockValues }));

vi.mock("../../src/db/schema.js", () => ({
	traces: {
		id: "id",
		cycleId: "cycle_id",
		playbookId: "playbook_id",
		timestamp: "timestamp",
		liveStateJson: "live_state_json",
		driftResultsJson: "drift_results_json",
		riskScore: "risk_score",
		riskState: "risk_state",
		enforcementAction: "enforcement_action",
		actionTarget: "action_target",
		actionResult: "action_result",
		actionError: "action_error",
		reasoning: "reasoning",
		createdAt: "created_at",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field, value) => ({ field, value })),
	and: vi.fn((...conditions) => ({ conditions })),
	desc: vi.fn((field) => ({ field, dir: "desc" })),
}));

function makeSampleTrace(overrides?: Partial<DecisionTrace>): DecisionTrace {
	return {
		id: "trace-123",
		cycleId: "cycle-1",
		playbookId: "pb-1",
		timestamp: "2026-06-11T12:00:00.000Z",
		liveStateSnapshot: {
			timestamp: "2026-06-11T12:00:00.000Z",
			accountBalance: 1000,
			openOrders: [],
			openPlanOrders: [],
			positions: [],
			currentDrawdown: 2.5,
			totalExposure: 50,
			rollingSharpe: 1.2,
		},
		contractSnapshot: {
			playbookId: "pb-1",
			derivedAt: "2026-06-10T12:00:00.000Z",
			allowedSymbols: ["BTCUSDT"],
			maxDrawdownPct: 6.84,
			backTestSharpe: 1.5,
			marginBudget: 100,
			executionMode: "follow_trade",
			expectedReturnPct: 30,
			totalTrades: 100,
		},
		driftResults: [
			{
				ruleId: "asset-drift",
				ruleName: "Asset Drift",
				contractField: "allowedSymbols",
				result: "pass",
				observedValue: "none",
				contractBound: "BTCUSDT",
				severity: 0,
			},
		],
		riskScore: 0,
		riskState: "healthy",
		enforcementAction: "none",
		reasoning: "All 4 rules passed. Risk score 0 (healthy). No action taken.",
		...overrides,
	};
}

describe("trace store", () => {
	// biome-ignore lint/suspicious/noExplicitAny: test mock
	let db: any;

	beforeEach(() => {
		vi.clearAllMocks();
		db = { insert: mockInsert, select: mockSelect };
	});

	it("saveTrace inserts with correct serialized values", async () => {
		const { saveTrace } = await import("../../src/trace/store.js");
		const trace = makeSampleTrace();
		saveTrace(db, trace);

		expect(mockInsert).toHaveBeenCalled();
		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "trace-123",
				cycleId: "cycle-1",
				playbookId: "pb-1",
				timestamp: "2026-06-11T12:00:00.000Z",
				liveStateJson: JSON.stringify(trace.liveStateSnapshot),
				driftResultsJson: JSON.stringify(trace.driftResults),
				riskScore: 0,
				riskState: "healthy",
				enforcementAction: "none",
				actionTarget: null,
				actionResult: null,
				actionError: null,
				reasoning: trace.reasoning,
			}),
		);
		expect(mockRun).toHaveBeenCalled();
	});

	it("saveTrace serializes actionTarget and actionResult when present", async () => {
		const { saveTrace } = await import("../../src/trace/store.js");
		const trace = makeSampleTrace({
			enforcementAction: "cancel_order",
			actionTarget: "ord-123",
			actionResult: "success",
		});
		saveTrace(db, trace);

		expect(mockValues).toHaveBeenCalledWith(
			expect.objectContaining({
				enforcementAction: "cancel_order",
				actionTarget: "ord-123",
				actionResult: "success",
				actionError: null,
			}),
		);
	});

	it("listTraces calls select with correct query structure", async () => {
		const { listTraces } = await import("../../src/trace/store.js");

		mockAll.mockReturnValue([
			{
				id: "t-1",
				cycleId: "c-1",
				playbookId: "pb-1",
				timestamp: "2026-06-11T12:00:00.000Z",
				liveStateJson: JSON.stringify({
					accountBalance: 1000,
					openOrders: [],
					openPlanOrders: [],
					positions: [],
					currentDrawdown: 0,
					totalExposure: 0,
					rollingSharpe: 0,
					timestamp: "2026-06-11T12:00:00.000Z",
				}),
				driftResultsJson: JSON.stringify([]),
				riskScore: 0,
				riskState: "healthy",
				enforcementAction: "none",
				actionTarget: null,
				actionResult: null,
				actionError: null,
				reasoning: "All passed",
				createdAt: "2026-06-11T12:00:00",
			},
		]);

		const results = listTraces(db);
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe("t-1");
		expect(results[0].reasoning).toBe("All passed");
		expect(results[0].liveStateSnapshot.accountBalance).toBe(1000);
	});

	it("listTraces applies playbookId filter", async () => {
		const { listTraces } = await import("../../src/trace/store.js");
		const { eq } = await import("drizzle-orm");

		mockAll.mockReturnValue([]);
		listTraces(db, { playbookId: "pb-1" });

		expect(eq).toHaveBeenCalled();
	});

	it("getTrace returns parsed trace for existing id", async () => {
		const { getTrace } = await import("../../src/trace/store.js");

		mockGet.mockReturnValue({
			id: "t-1",
			cycleId: "c-1",
			playbookId: "pb-1",
			timestamp: "2026-06-11T12:00:00.000Z",
			liveStateJson: JSON.stringify({
				accountBalance: 500,
				openOrders: [],
				openPlanOrders: [],
				positions: [],
				currentDrawdown: 1,
				totalExposure: 0,
				rollingSharpe: 0.8,
				timestamp: "2026-06-11T12:00:00.000Z",
			}),
			driftResultsJson: JSON.stringify([
				{
					ruleId: "asset-drift",
					ruleName: "Asset Drift",
					contractField: "allowedSymbols",
					result: "pass",
					observedValue: "none",
					contractBound: "BTCUSDT",
					severity: 0,
				},
			]),
			riskScore: 10,
			riskState: "elevated",
			enforcementAction: "cancel_order",
			actionTarget: "ord-1",
			actionResult: "success",
			actionError: null,
			reasoning: "Detected drift",
			createdAt: "2026-06-11T12:00:00",
		});

		const result = getTrace(db, "t-1");
		expect(result).not.toBeNull();
		expect(result?.id).toBe("t-1");
		expect(result?.riskScore).toBe(10);
		expect(result?.enforcementAction).toBe("cancel_order");
		expect(result?.actionTarget).toBe("ord-1");
		expect(result?.liveStateSnapshot.accountBalance).toBe(500);
		expect(result?.driftResults).toHaveLength(1);
	});

	it("getTrace returns null for unknown id", async () => {
		const { getTrace } = await import("../../src/trace/store.js");
		mockGet.mockReturnValue(undefined);

		const result = getTrace(db, "nonexistent");
		expect(result).toBeNull();
	});
});
