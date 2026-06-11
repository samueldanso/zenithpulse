import type { BehavioralContract } from "@zenithpulse/shared";
import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema.js";

type Db = BunSQLiteDatabase<typeof schema>;

export function saveContract(
	db: Db,
	playbookId: string,
	name: string,
	contract: BehavioralContract,
): void {
	db.insert(schema.playbooks)
		.values({
			id: playbookId,
			name,
			contractJson: JSON.stringify(contract),
			contractDerivedAt: contract.derivedAt,
		})
		.onConflictDoUpdate({
			target: schema.playbooks.id,
			set: {
				name,
				contractJson: JSON.stringify(contract),
				contractDerivedAt: contract.derivedAt,
			},
		})
		.run();
}

export function loadContract(db: Db, playbookId: string): BehavioralContract | null {
	const row = db.select().from(schema.playbooks).where(eq(schema.playbooks.id, playbookId)).get();

	if (!row?.contractJson) {
		return null;
	}

	return JSON.parse(row.contractJson) as BehavioralContract;
}
