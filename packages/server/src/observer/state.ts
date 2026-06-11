import type { LiveState, Order, Position } from "@zenithpulse/shared";

export function computeTotalExposure(positions: Position[], openOrders: Order[]): number {
	const positionNotional = positions.reduce((sum, p) => {
		const size = Number.parseFloat(p.total) || 0;
		const price = Number.parseFloat(p.averageOpenPrice) || 0;
		return sum + size * price;
	}, 0);
	// Include unfilled open orders — they represent potential exposure
	// if they fill and should be counted for oversize detection
	const orderNotional = openOrders.reduce((sum, o) => {
		const size = Number.parseFloat(o.size) || 0;
		const price = Number.parseFloat(o.price) || 0;
		return sum + size * price;
	}, 0);
	return positionNotional + orderNotional;
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
