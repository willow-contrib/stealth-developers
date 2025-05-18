import { Client, Events, GatewayIntentBits } from "discord.js";

import registerEvents from "./handlers/events.ts";
import registerInteractions from "./handlers/interactions.ts";

import cfg from "./config.ts";
import { COLOURS, Logger } from "./utils/logging.ts";

const logger = new Logger("bot", {
	timestamp: true,
	colorize: true,
	scopeColor: COLOURS.FG_CYAN,
});
const client = new Client({
	intents: [GatewayIntentBits.Guilds],
});

client.on(Events.ClientReady, async (client) => {
	logger.info(`logged in as ${client.user?.tag}!`);

	await Promise.all([registerEvents(client), registerInteractions(client)]);
	logger.info("events and interactions registered!");
	logger.newLine();
});

await client.login(cfg.data.discord.token);

process.on("unhandledRejection", (error) => {
	logger.error("unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
	logger.error("uncaught exception:", error);
});
