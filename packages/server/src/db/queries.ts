import { eq } from "drizzle-orm";
import type { getDb } from "./client.js";
import * as schema from "./schema.js";

type Db = ReturnType<typeof getDb>;

export function updatePlaybookRiskState(
	db: Db,
	playbookId: string,
	riskScore: number,
	riskState: string,
): void {
	db.update(schema.playbooks)
		.set({ riskScore, riskState })
		.where(eq(schema.playbooks.id, playbookId))
		.run();
}
