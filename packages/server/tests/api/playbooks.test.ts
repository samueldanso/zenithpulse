import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAll = vi.fn((): unknown[] => []);
const mockGet = vi.fn((): unknown => undefined);
const mockRun = vi.fn();
const mockWhere = vi.fn(() => ({ get: mockGet, all: mockAll }));
const mockSet = vi.fn(() => ({ where: vi.fn(() => ({ run: mockRun })) }));
const mockFrom = vi.fn(() => ({ where: mockWhere, all: mockAll }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));
const mockUpdate = vi.fn(() => ({ set: mockSet }));

vi.mock("../../src/db/schema.js", () => ({
	playbooks: { id: "id", name: "name", mode: "mode" },
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((field, value) => ({ field, value })),
	count: vi.fn(() => "count"),
}));

const mockDb = {
	select: mockSelect,
	update: mockUpdate,
};

describe("playbook routes", () => {
	let app: Hono;

	beforeEach(async () => {
		vi.clearAllMocks();

		const { createPlaybookRoutes } = await import("../../src/api/routes/playbooks.js");
		app = new Hono().route(
			"/api/playbooks",
			// biome-ignore lint/suspicious/noExplicitAny: vitest mock cannot satisfy full Drizzle type
			createPlaybookRoutes(mockDb as any),
		);
	});

	it("GET /api/playbooks returns 200 with array", async () => {
		mockAll.mockReturnValue([
			{
				id: "pb-1",
				name: "BTC Trend",
				mode: "observe",
				riskScore: 15,
				riskState: "elevated",
				lastObservedAt: "2026-06-11T12:00:00Z",
				contractJson: null,
				contractDerivedAt: null,
				createdAt: "2026-06-10T00:00:00",
			},
		]);

		const res = await app.request("/api/playbooks");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body).toHaveLength(1);
		expect(body[0].id).toBe("pb-1");
		expect(body[0].name).toBe("BTC Trend");
		expect(body[0].riskScore).toBe(15);
	});

	it("GET /api/playbooks/:id returns 200 with contract field", async () => {
		const contract = {
			playbookId: "pb-1",
			derivedAt: "2026-06-10T12:00:00Z",
			allowedSymbols: ["BTCUSDT"],
			maxDrawdownPct: 6.84,
			backTestSharpe: 1.5,
			marginBudget: 100,
			executionMode: "follow_trade",
			expectedReturnPct: 30,
			totalTrades: 100,
		};

		mockGet.mockReturnValue({
			id: "pb-1",
			name: "BTC Trend",
			mode: "observe",
			riskScore: 10,
			riskState: "healthy",
			lastObservedAt: "2026-06-11T12:00:00Z",
			contractJson: JSON.stringify(contract),
			contractDerivedAt: "2026-06-10T12:00:00Z",
			createdAt: "2026-06-10T00:00:00",
		});

		const res = await app.request("/api/playbooks/pb-1");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.id).toBe("pb-1");
		expect(body.contract).toEqual(contract);
	});

	it("GET /api/playbooks/unknown returns 404", async () => {
		mockGet.mockReturnValue(undefined);

		const res = await app.request("/api/playbooks/unknown");
		expect(res.status).toBe(404);

		const body = await res.json();
		expect(body.error).toBe("Playbook not found");
	});

	it("PATCH /api/playbooks/:id/mode with valid mode returns 200", async () => {
		mockGet.mockReturnValue({
			id: "pb-1",
			name: "BTC Trend",
			mode: "observe",
		});

		const res = await app.request("/api/playbooks/pb-1/mode", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode: "enforce" }),
		});

		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body.id).toBe("pb-1");
		expect(body.mode).toBe("enforce");
	});

	it("PATCH /api/playbooks/:id/mode with invalid mode returns 400", async () => {
		mockGet.mockReturnValue({
			id: "pb-1",
			name: "BTC Trend",
			mode: "observe",
		});

		const res = await app.request("/api/playbooks/pb-1/mode", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ mode: "invalid" }),
		});

		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.error).toBe("Invalid mode. Must be observe, enforce, or silent");
	});
});
