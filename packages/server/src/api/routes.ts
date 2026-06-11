import { Hono } from "hono";

const startTime = Date.now();

export const routes = new Hono();

routes.get("/api/health", (c) => {
	return c.json({ status: "ok", uptime: Date.now() - startTime });
});
