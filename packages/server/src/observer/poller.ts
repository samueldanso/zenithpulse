import type { LiveState } from "@zenithpulse/shared";
import type { BitgetClient } from "../bitget/client.js";
import { computeCurrentDrawdown, computeTotalExposure } from "./state.js";

export interface PollResult {
	liveState: LiveState;
	newPeak: number;
}

export async function pollLiveState(
	bitgetClient: BitgetClient,
	currentPeak: number,
): Promise<PollResult> {
	const [accountBalance, openOrders, openPlanOrders, positions] = await Promise.all([
		bitgetClient.getAccountBalance().catch(() => 0),
		bitgetClient.getOpenOrders().catch(() => []),
		bitgetClient.getPlanOrders().catch(() => []),
		bitgetClient.getFuturesPositions("USDT-FUTURES").catch(() => []),
	]);

	const newPeak = accountBalance > currentPeak ? accountBalance : currentPeak;

	const totalExposure = computeTotalExposure(positions, openOrders);
	const currentDrawdown = computeCurrentDrawdown(accountBalance, newPeak);

	return {
		liveState: {
			timestamp: new Date().toISOString(),
			accountBalance,
			openOrders,
			openPlanOrders,
			positions,
			currentDrawdown,
			totalExposure,
			rollingSharpe: 0,
		},
		newPeak,
	};
}
