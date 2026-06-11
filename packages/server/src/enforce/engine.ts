import type { DriftResult, LiveState } from "@zenithpulse/shared";
import type { EnforcementAction, EnforcementPlan } from "./types.js";

export function decideEnforcement(
	mode: string,
	driftResults: DriftResult[],
	state: LiveState,
): EnforcementPlan {
	if (mode !== "enforce") {
		return {
			actions: [{ type: "none", reason: `mode is ${mode}` }],
			mode,
		};
	}

	const actions: EnforcementAction[] = [];

	for (const drift of driftResults) {
		if (drift.result !== "violation") continue;

		switch (drift.ruleId) {
			case "asset-drift": {
				for (const order of state.openOrders) {
					actions.push({
						type: "cancel_order",
						orderId: order.orderId,
						symbol: order.symbol,
						reason: "asset-drift: order on unauthorized symbol",
					});
				}
				break;
			}
			case "drawdown-breach": {
				for (const position of state.positions) {
					actions.push({
						type: "close_position",
						symbol: position.symbol,
						holdSide: position.holdSide,
						size: position.total,
						reason: "drawdown-breach: closing position to limit loss",
					});
				}
				break;
			}
			case "oversize": {
				const largest = findLargestPosition(state);
				if (largest) {
					actions.push({
						type: "close_position",
						symbol: largest.symbol,
						holdSide: largest.holdSide,
						size: largest.total,
						reason: "oversize: closing largest position to reduce exposure",
					});
				}
				break;
			}
		}
	}

	if (actions.length === 0) {
		return {
			actions: [{ type: "none", reason: "no violations" }],
			mode,
		};
	}

	return { actions, mode };
}

function findLargestPosition(state: LiveState) {
	if (state.positions.length === 0) return null;

	let largest = state.positions[0];
	let largestNotional = Number.parseFloat(largest.total) * Number.parseFloat(largest.marginSize);

	for (let i = 1; i < state.positions.length; i++) {
		const pos = state.positions[i];
		const notional = Number.parseFloat(pos.total) * Number.parseFloat(pos.marginSize);
		if (notional > largestNotional) {
			largest = pos;
			largestNotional = notional;
		}
	}

	return largest;
}
