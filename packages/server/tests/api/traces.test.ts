import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTraces = [
	{
		id: "t-1",
		cycleId: "c-1",
		playbookId: "pb-1",
		timestamp: "2026-06-11T12:00:00Z",
		liveStateSnapshot: { accountBalance: 1000 },
		contractSnapshot: { playbookId: "pb-1" },
		driftResults: [],
		riskScore: 0,
		riskState: "healthy",
		enforcementAction: "none",
		reasoning: "All passed",
	},
];

vi.mock("../../src/trace/store.js", () => ({
	listTraces: vi.fn(() => mockTraces),
	getTrace: vi.fn((_, id: string) => {
		if (id === "t-1") return mockTraces[0];
		return null;
	}),
}));

vi.mock("../../src/db/schema.js", () => ({
	traces: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
	count: vi.fn(() => "count"),
}));

const mockGet = vi.fn(() => ({ value: 1 }));
const mockFrom = vi.fn(() => ({ get: mockGet }));
const mockSelect = vi.fn(() => ({ from: mockFrom }));

const mockDb = { select: mockSelect };

describe("trace routes", () => {
	let app: Hono;

	beforeEach(async () => {
		vi.clearAllMocks();
		mockGet.mockReturnValue({ value: 1 });

		const { createTraceRoutes } = await import("../../src/api/traces.js");
		// biome-ignore lint/suspicious/noExplicitAny: test mock
		app = new Hono().route("/api/traces", createTraceRoutes(mockDb as any));
	});

	it("GET /api/traces returns 200 with data, total, limit, offset", async () => {
		const res = await app.request("/api/traces");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.data).toHaveLength(1);
		expect(body.total).toBe(1);
		expect(body.limit).toBe(50);
		expect(body.offset).toBe(0);
	});

	it("GET /api/traces?playbook_id=X passes filter to listTraces", async () => {
		const { listTraces } = await import("../../src/trace/store.js");

		await app.request("/api/traces?playbook_id=pb-1");

		expect(listTraces).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ playbookId: "pb-1" }),
		);
	});

	it("GET /api/traces/:id returns 200 with full trace", async () => {
		const res = await app.request("/api/traces/t-1");
		expect(res.status).toBe(200);

		const body = await res.json();
		expect(body.id).toBe("t-1");
		expect(body.reasoning).toBe("All passed");
	});

	it("GET /api/traces/unknown returns 404", async () => {
		const res = await app.request("/api/traces/unknown");
		expect(res.status).toBe(404);

		const body = await res.json();
		expect(body.error).toBe("Trace not found");
	});
});
