import type { ApplicationCommandData, Client, Snowflake } from "discord.js";
import { Collection, REST, Routes } from "discord.js";

import cfg from "@/config.ts";
import type { ICommand } from "@/types.ts";
import lily from "@/utils/logging.ts";
import { crawlDirectory, getHandlerPath } from "./common.ts";

const logger = lily.child("interactions");
export const commands = new Collection<string, ICommand>();

async function getCommands(): Promise<ICommand[]> {
	const processFile = async (fileUrl: string) => {
		const { default: interaction } = await import(fileUrl);
		if (!interaction) return;

		if (!interaction.data) {
			logger.info(`${fileUrl} does not have a data property, skipping`);
			return;
		}

		if (interaction.enabled === false) {
			logger.info(`${interaction.data.name} was disabled, skipping`);
			return;
		}

		commands.set(interaction.data.name, interaction);
		return interaction;
	};

	return await crawlDirectory<ICommand>(
		getHandlerPath("interactions"),
		processFile,
	);
}

async function registerInteractions(
	client: Client,
	interactions: ApplicationCommandData[],
) {
	if (!client.user) return logger.error("client user is not available");
	if (!client.application)
		return logger.error("client application is not available");
	if (interactions.length === 0) return;

	logger.info("registering interactions...");
	const rest = new REST({ version: "9" }).setToken(cfg.data.discord.token);

	try {
		logger.info("registering commands...");
		await rest.put(Routes.applicationCommands(<Snowflake>client.user.id), {
			body: interactions,
		});
		logger.info(`registered ${interactions.length} commands`);
	} catch (error) {
		logger.error("failed to register commands", error);
	}
}

async function registerCommands(client: Client) {
	const commands = await getCommands();
	if (commands.length === 0) return logger.warn("no commands found");

	const interactions = commands.map((command) => command.data);
	await registerInteractions(client, interactions);
}

export default registerCommands;
