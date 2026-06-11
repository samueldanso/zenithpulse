import type { LiveState, Position } from "@zenithpulse/shared";

export function computeTotalExposure(positions: Position[]): number {
	return positions.reduce((sum, p) => {
		const size = Number.parseFloat(p.total) || 0;
		const price = Number.parseFloat(p.averageOpenPrice) || 0;
		return sum + size * price;
	}, 0);
}

export function computeCurrentDrawdown(currentBalance: number, peakBalance: number): number {
	if (peakBalance <= 0) return 0;
	const drawdown = ((peakBalance - currentBalance) / peakBalance) * 100;
	return Math.max(0, drawdown);
}

export function buildEmptyLiveState(): LiveState {
	return {
		timestamp: new Date().toISOString(),
		accountBalance: 0,
		openOrders: [],
		openPlanOrders: [],
		positions: [],
		currentDrawdown: 0,
		totalExposure: 0,
		rollingSharpe: 0,
	};
}
