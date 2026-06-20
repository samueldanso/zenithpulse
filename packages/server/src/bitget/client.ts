import type { Order, PlanOrder, Position } from "@zenithpulse/shared";
import { BitgetRestClient } from "bitget-core";
import type { AppConfig } from "../config.js";

interface BitgetApiPosition {
	symbol: string;
	holdSide: string;
	total: string;
	available: string;
	averageOpenPrice: string;
	unrealizedPL: string;
	marginSize: string;
	leverage: string;
}

interface BitgetApiOrder {
	orderId: string;
	symbol: string;
	side: string;
	orderType: string;
	price: string;
	size: string;
	status: string;
	cTime: string;
}

interface BitgetApiPlanOrder {
	orderId: string;
	symbol: string;
	side: string;
	planType: string;
	triggerPrice: string;
	size: string;
	status: string;
	cTime: string;
}

interface BitgetAccountAsset {
	marginCoin: string;
	available: string;
	equity: string;
	usdtEquity: string;
}

function mapPosition(raw: BitgetApiPosition): Position {
	return {
		symbol: raw.symbol,
		holdSide: raw.holdSide,
		total: raw.total,
		available: raw.available,
		averageOpenPrice: raw.averageOpenPrice,
		unrealizedPL: raw.unrealizedPL,
		marginSize: raw.marginSize,
		leverage: raw.leverage,
	};
}

function mapOrder(raw: BitgetApiOrder): Order {
	return {
		orderId: raw.orderId,
		symbol: raw.symbol,
		side: raw.side,
		orderType: raw.orderType,
		price: raw.price,
		size: raw.size,
		status: raw.status,
		createTime: raw.cTime,
	};
}

function mapPlanOrder(raw: BitgetApiPlanOrder): PlanOrder {
	return {
		orderId: raw.orderId,
		symbol: raw.symbol,
		side: raw.side,
		planType: raw.planType,
		triggerPrice: raw.triggerPrice,
		size: raw.size,
		status: raw.status,
		createTime: raw.cTime,
	};
}

export function createBitgetClient(config: AppConfig) {
	const client = new BitgetRestClient({
		apiKey: config.BITGET_API_KEY,
		secretKey: config.BITGET_SECRET_KEY,
		passphrase: config.BITGET_PASSPHRASE,
		hasAuth: true,
		baseUrl: "https://api.bitget.com",
		timeoutMs: 15_000,
		modules: ["futures", "account"],
		readOnly: false,
		paperTrading: config.PAPER_TRADING,
	});

	return {
		async getFuturesPositions(productType: "USDT-FUTURES"): Promise<Position[]> {
			const result = await client.privateGet<BitgetApiPosition[]>(
				"/api/v2/mix/position/all-position",
				{ productType },
			);
			const data = result.data ?? [];
			return data.map(mapPosition);
		},

		async getOpenOrders(symbol?: string): Promise<Order[]> {
			const result = await client.privateGet<{ entrustedList: BitgetApiOrder[] }>(
				"/api/v2/mix/order/orders-pending",
				{ productType: "USDT-FUTURES", symbol },
			);
			const list = result.data?.entrustedList ?? [];
			return list.map(mapOrder);
		},

		async getPlanOrders(symbol?: string): Promise<PlanOrder[]> {
			const result = await client.privateGet<{ entrustedList: BitgetApiPlanOrder[] }>(
				"/api/v2/mix/order/orders-plan-pending",
				{ productType: "USDT-FUTURES", symbol },
			);
			const list = result.data?.entrustedList ?? [];
			return list.map(mapPlanOrder);
		},

		async getAccountBalance(): Promise<number> {
			const result = await client.privateGet<BitgetAccountAsset[]>("/api/v2/mix/account/accounts", {
				productType: "USDT-FUTURES",
			});
			const assets = result.data ?? [];
			const usdt = assets.find((a) => a.marginCoin === "USDT");
			return usdt ? Number.parseFloat(usdt.usdtEquity) : 0;
		},

		async cancelFuturesOrder(
			symbol: string,
			orderId: string,
		): Promise<{ success: boolean; orderId: string }> {
			await client.privatePost("/api/v2/mix/order/cancel-order", {
				productType: "USDT-FUTURES",
				symbol,
				orderId,
			});
			return { success: true, orderId };
		},

		async cancelPlanOrder(
			symbol: string,
			orderId: string,
		): Promise<{ success: boolean; orderId: string }> {
			await client.privatePost("/api/v2/mix/order/cancel-plan-order", {
				productType: "USDT-FUTURES",
				symbol,
				orderId,
			});
			return { success: true, orderId };
		},

		async closeFuturesPosition(
			symbol: string,
			holdSide: string,
			size: string,
		): Promise<{ success: boolean; orderId: string }> {
			const result = await client.privatePost<{ orderId: string }>(
				"/api/v2/mix/order/place-order",
				{
					symbol,
					productType: "USDT-FUTURES",
					marginMode: "crossed",
					marginCoin: "USDT",
					// "buy" for short close is correct futures semantics — tradeSide:"close" is the true intent
					side: holdSide === "long" ? "sell" : "buy",
					tradeSide: "close",
					orderType: "market",
					size,
				},
			);
			return { success: true, orderId: result.data?.orderId ?? "" };
		},
	};
}

export type BitgetClient = ReturnType<typeof createBitgetClient>;
