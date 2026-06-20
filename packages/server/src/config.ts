import { z } from "zod";

const envSchema = z.object({
	BITGET_API_KEY: z.string().min(1, "BITGET_API_KEY is required"),
	BITGET_SECRET_KEY: z.string().min(1, "BITGET_SECRET_KEY is required"),
	BITGET_PASSPHRASE: z.string().min(1, "BITGET_PASSPHRASE is required"),
	DB_PATH: z.string().default("./data/zenithpulse.db"),
	PORT: z.coerce.number().default(3001),
	POLL_INTERVAL_MS: z.coerce.number().default(15_000),
	MODE_DEFAULT: z.enum(["enforce", "observe", "silent"]).default("observe"),
	PAPER_TRADING: z
		.string()
		.transform((v) => v === "true")
		.default("false"),
	PLAYBOOK_ACCESS_KEY: z.string().optional(),
	PLAYBOOK_MARGIN_BUDGET: z.coerce.number().default(100),
	TELEGRAM_BOT_TOKEN: z.string().optional(),
	TELEGRAM_CHAT_ID: z.string().optional(),
	ZENITHPULSE_API_KEY: z.string().optional(),
	ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
	const result = envSchema.safeParse(process.env);
	if (!result.success) {
		const errors = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
		console.error(`[config] Missing or invalid environment variables:\n${errors}`);
		process.exit(1);
	}
	return result.data;
}
