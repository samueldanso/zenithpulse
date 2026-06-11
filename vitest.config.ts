import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		exclude: [".resources/**", "node_modules/**"],
	},
});
