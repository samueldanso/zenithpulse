import { Hono } from "hono";
import { SKILL_MARKDOWN } from "../skill-content.js";

export function createSkillRoute(): Hono {
	const app = new Hono();

	app.get("/", (c) => {
		return c.text(SKILL_MARKDOWN, 200, { "Content-Type": "text/markdown; charset=utf-8" });
	});

	return app;
}
