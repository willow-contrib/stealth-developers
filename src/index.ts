import { Client, Events, GatewayIntentBits } from "discord.js";

import { connectDatabase } from "./database/connection";
import registerEvents from "./handlers/events.ts";
import registerInteractions from "./handlers/interactions.ts";

import cfg from "./config.ts";
import { watchForum } from "./utils/forumWatcher.ts";
import logger from "./utils/logging.ts";

const client = new Client({
	intents: [
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.Guilds,
		GatewayIntentBits.MessageContent,
	],
});

client.on(Events.ClientReady, async (client) => {
	logger.info(`logged in as ${client.user?.tag}!`);

	await connectDatabase();
	await Promise.all([registerEvents(client), registerInteractions(client)]);
	logger.info("events and interactions registered!");
	console.log();

	const forumConfig = cfg.data.roblox?.forumWatcher;
	if (!forumConfig || !forumConfig.enabled) return;
	await watchForum(client);
	setInterval(
		() => {
			watchForum(client).catch((error) => {
				logger.error("error while watching forum:", error);
			});
		},
		forumConfig.interval * 1000 || 60000,
	);
});

await client.login(cfg.data.discord.token);

process.on("unhandledRejection", (error) => {
	logger.error("unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
	logger.error("uncaught exception:", error);
});
