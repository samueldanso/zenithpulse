import { z } from "zod";
import type { AppConfig } from "../config.js";

const officialMetricsSchema = z.object({
	max_drawdown_pct: z.number(),
	sharpe_ratio: z.number(),
	total_return_pct: z.number(),
	total_trades: z.number(),
});

const playbookSchema = z.object({
	strategy_id: z.string(),
	name: z.string(),
	trading_symbols: z.array(z.string()),
	official_metrics: officialMetricsSchema,
	execution_mode: z.enum(["signal_only", "follow_trade"]),
});

const playbookListSchema = z.array(playbookSchema);

const playbookRunSchema = z.object({
	run_id: z.string(),
	strategy_id: z.string(),
	name: z.string(),
	status: z.string(),
	trading_symbols: z.array(z.string()),
	official_metrics: officialMetricsSchema,
	execution_mode: z.enum(["signal_only", "follow_trade"]),
});

export type Playbook = z.infer<typeof playbookSchema>;
export type PlaybookRun = z.infer<typeof playbookRunSchema>;

const MOCK_PLAYBOOKS: Playbook[] = [
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
		execution_mode: "follow_trade",
	},
];

const MOCK_RUN: PlaybookRun = {
	run_id: "run-demo-001",
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
	execution_mode: "follow_trade",
};

export function createPlaybookClient(config: AppConfig) {
	const accessKey = config.PLAYBOOK_ACCESS_KEY;
	const baseUrl = "https://api.bitget.com";

	if (!accessKey) {
		console.warn("[playbook-api] PLAYBOOK_ACCESS_KEY not set — using mock data");
	}

	async function fetchApi<T>(path: string, schema: z.ZodType<T>): Promise<T> {
		const response = await fetch(`${baseUrl}${path}`, {
			headers: {
				"ACCESS-KEY": accessKey ?? "",
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Playbook API error: ${response.status} ${response.statusText}`);
		}

		const json = await response.json();
		return schema.parse(json);
	}

	return {
		async listPlaybooks(): Promise<Playbook[]> {
			if (!accessKey) {
				return MOCK_PLAYBOOKS;
			}
			return fetchApi("/api/v1/getagent/playbooks", playbookListSchema);
		},

		async getPlaybookRun(runId: string): Promise<PlaybookRun> {
			if (!accessKey) {
				return MOCK_RUN;
			}
			return fetchApi(`/api/v1/getagent/playbooks/runs/${runId}`, playbookRunSchema);
		},
	};
}

export type PlaybookClient = ReturnType<typeof createPlaybookClient>;
