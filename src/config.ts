import fs from "node:fs";

import { env } from "bun";
import { z } from "zod";

const discordSchema = z.object({
	token: z.string(),
	app_id: z.string(),
});

const schema = z.object({
	discord: discordSchema,
});

function validateConfig() {
	const runtimeConfig = JSON.parse(fs.readFileSync(".config.json", "utf8"));
	const conf = schema.safeParse(runtimeConfig);
	if (conf.success) return conf.data;

	console.error("invalid environment variables");
	for (const err of conf.error.errors)
		console.log(`  ${err.message}: ${err.path}`);
	process.exit(1);
}

export default { data: validateConfig() };
