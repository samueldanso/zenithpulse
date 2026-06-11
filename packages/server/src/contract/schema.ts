import { z } from "zod";

export const officialMetricsSchema = z.object({
	max_drawdown_pct: z.number().optional(),
	sharpe_ratio: z.number().optional(),
	total_return_pct: z.number().optional(),
	total_trades: z.number().optional(),
});

export const playbookDataSchema = z.object({
	strategy_id: z.string(),
	name: z.string(),
	trading_symbols: z.array(z.string()).optional(),
	official_metrics: officialMetricsSchema.optional(),
	execution_mode: z.enum(["signal_only", "follow_trade"]).optional(),
});

export type PlaybookData = z.infer<typeof playbookDataSchema>;
