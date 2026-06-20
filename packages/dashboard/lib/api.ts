const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, init);
	if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
	return res.json() as Promise<T>;
}

export type RiskState = "healthy" | "elevated" | "critical";
export type ExecutionMode = "observe" | "enforce" | "silent";

export interface Playbook {
	id: string;
	name: string;
	displayName: string;
	status: string;
	executionMode: ExecutionMode;
	riskScore: number;
	riskState: RiskState;
	lastObservedAt: string | null;
	contract?: {
		playbookId: string;
		derivedAt: string;
		allowedSymbols: string[];
		maxDrawdownPct: number;
		backTestSharpe: number;
		marginBudget: number;
		executionMode: string;
		expectedReturnPct: number;
		totalTrades: number;
	} | null;
}

export interface TraceRow {
	id: string;
	cycleId: string;
	playbookId: string;
	timestamp: string;
	riskScore: number;
	riskState: RiskState;
	enforcementAction: string;
	actionTarget: string | null;
	actionResult: string | null;
	reasoning: string;
	createdAt: string;
}

export interface TracesResponse {
	data: TraceRow[];
	total: number;
	limit: number;
	offset: number;
}

export interface HealthResponse {
	status: "ok" | "degraded";
	uptime: number;
	lastCycleAt: string | null;
	playbookCount: number;
	observerRunning: boolean;
}

export const getPlaybooks = () => fetchApi<Playbook[]>("/api/playbooks");

export const getPlaybook = (id: string) => fetchApi<Playbook>(`/api/playbooks/${id}`);

export const patchMode = (id: string, mode: ExecutionMode) =>
	fetchApi<{ id: string; mode: string }>(`/api/playbooks/${id}/mode`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mode }),
	});

export const getTraces = (params?: {
	playbook_id?: string;
	limit?: number;
	offset?: number;
	action?: string;
}) => {
	const qs = new URLSearchParams();
	if (params?.playbook_id) qs.set("playbook_id", params.playbook_id);
	if (params?.limit) qs.set("limit", String(params.limit));
	if (params?.offset) qs.set("offset", String(params.offset));
	if (params?.action) qs.set("action", params.action);
	return fetchApi<TracesResponse>(`/api/traces?${qs}`);
};

export const getHealth = () => fetchApi<HealthResponse>("/api/health");
