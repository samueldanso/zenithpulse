import type { BitgetClient } from "../bitget/client.js";
import type { ActionResult, EnforcementPlan } from "./types.js";

export async function executeEnforcement(
	plan: EnforcementPlan,
	bitgetClient: BitgetClient,
): Promise<ActionResult[]> {
	const results: ActionResult[] = [];

	for (const action of plan.actions) {
		try {
			switch (action.type) {
				case "none": {
					results.push({ success: true, action });
					break;
				}
				case "cancel_order": {
					await bitgetClient.cancelFuturesOrder(action.symbol, action.orderId);
					results.push({ success: true, action });
					break;
				}
				case "cancel_plan_order": {
					await bitgetClient.cancelPlanOrder(action.symbol, action.orderId);
					results.push({ success: true, action });
					break;
				}
				case "close_position": {
					await bitgetClient.closeFuturesPosition(action.symbol, action.holdSide, action.size);
					results.push({ success: true, action });
					break;
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			results.push({ success: false, action, error: message });
		}
	}

	return results;
}
