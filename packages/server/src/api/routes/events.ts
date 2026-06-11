import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eventBus } from "../emitter.js";

export function createEventRoutes() {
	const app = new Hono();

	app.get("/", (c) => {
		return streamSSE(c, async (stream) => {
			await stream.writeSSE({
				event: "connected",
				data: JSON.stringify({ timestamp: new Date().toISOString() }),
			});

			const unsubscribers: (() => void)[] = [];

			const unsubCycle = eventBus.subscribe("cycle", (data) => {
				stream.writeSSE({ event: "cycle", data: JSON.stringify(data) }).catch(() => {});
			});
			unsubscribers.push(unsubCycle);

			const unsubEnforcement = eventBus.subscribe("enforcement", (data) => {
				stream.writeSSE({ event: "enforcement", data: JSON.stringify(data) }).catch(() => {});
			});
			unsubscribers.push(unsubEnforcement);

			const heartbeat = setInterval(() => {
				stream.write(": heartbeat\n\n").catch(() => {});
			}, 30_000);

			stream.onAbort(() => {
				clearInterval(heartbeat);
				for (const unsub of unsubscribers) {
					unsub();
				}
			});

			await new Promise<void>((resolve) => {
				stream.onAbort(() => resolve());
			});
		});
	});

	return app;
}
