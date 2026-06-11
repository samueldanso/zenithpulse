import type { LiveState } from "@zenithpulse/shared";
import type { BitgetClient } from "../bitget/client.js";
import { computeCurrentDrawdown, computeTotalExposure } from "./state.js";

let peakBalance = 0;

export function resetPeakBalance(): void {
	peakBalance = 0;
}

export async function pollLiveState(bitgetClient: BitgetClient): Promise<LiveState> {
	const [accountBalance, openOrders, openPlanOrders, positions] = await Promise.all([
		bitgetClient.getAccountBalance().catch(() => 0),
		bitgetClient.getOpenOrders().catch(() => []),
		bitgetClient.getPlanOrders().catch(() => []),
		bitgetClient.getFuturesPositions("USDT-FUTURES").catch(() => []),
	]);

	if (accountBalance > peakBalance) {
		peakBalance = accountBalance;
	}

	const totalExposure = computeTotalExposure(positions, openOrders);
	const currentDrawdown = computeCurrentDrawdown(accountBalance, peakBalance);

	return {
		timestamp: new Date().toISOString(),
		accountBalance,
		openOrders,
		openPlanOrders,
		positions,
		currentDrawdown,
		totalExposure,
		rollingSharpe: 0,
	};
}
