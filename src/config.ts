import fs from "node:fs";
import { z } from "zod";

const discordSchema = z.object({
	token: z.string(),
	app_id: z.string(),
});

const mongodbSchema = z.object({
	uri: z.string(),
	database: z.string(),
});

const projectSchema = z.record(
	z.object({
		name: z.string(),
		displayName: z.string(),
		iconURL: z.string().optional(),
		codes: z
			.array(
				z.object({
					code: z.string(),
					expired: z.boolean().optional(),
					expiredAt: z.string().datetime().optional(),
					addedAt: z.string().datetime().optional(),
				}),
			)
			.optional(),
	}),
);

const robloxSchema = z.object({
	apiKey: z.string(),
	cookie: z.string().optional(),
});

const bloxlinkSchema = z.object({
	token: z.string(),
});

const schema = z.object({
	discord: discordSchema,
	mongodb: mongodbSchema,
	projects: projectSchema,
	bloxlink: bloxlinkSchema.optional(),
	roblox: robloxSchema.optional(),
	trelloBoardId: z.string().optional(),
	developerId: z.string(),
	terminology: z.string().default("project"),
});

function validateConfig() {
	const env = process.env.NODE_ENV || "DEV";

	const runtimeConfig = JSON.parse(
		fs.readFileSync(`.config.${env}.json`, "utf8"),
	);
	const conf = schema.safeParse(runtimeConfig);
	if (conf.success) return conf.data;

	console.error("invalid environment variables");
	for (const err of conf.error.errors)
		console.log(`  ${err.message}: ${err.path}`);
	process.exit(1);
}

export default { data: validateConfig() };
