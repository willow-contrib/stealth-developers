import { type BaseInteraction, type Client, Events } from "discord.js";
import { commands } from "../handlers/interactions";

import { loggers } from "@/utils/logging";
const logger = loggers.interactions;

export default {
	event: Events.InteractionCreate,
	async execute(client: Client, interaction: BaseInteraction) {
		if (interaction.isCommand()) {
			const command = commands.get(interaction.commandName);
			logger.info(`received command ${interaction.commandName}`);
			if (!command) return;
			try {
				await command.execute(client, interaction);
			} catch (error) {
				logger.error(
					`there was an error while executing ${interaction.commandName}`,
					error,
				);
				interaction.deferReply({ flags: ["Ephemeral"] });
				await interaction.followUp({
					content: "there was an error while executing this command!",
					flags: ["Ephemeral"],
				});
			}
		} else if (interaction.isButton()) {
			const [commandName, ..._args] = interaction.customId.split(":");
			const command = commands.get(commandName);
			if (!command || !command.buttonExecute) {
				return interaction.reply({
					content: "couldn't find the associated command!",
					flags: ["Ephemeral"],
				});
			}
			try {
				await command.buttonExecute(client, interaction);
			} catch (error) {
				logger.error(
					`there was an error while executing button with customId ${interaction.customId}`,
					error,
				);
				await interaction.reply({
					content: "there was an error while executing this button command!",
					flags: ["Ephemeral"],
				});
			}
		} else if (interaction.isModalSubmit()) {
			const [commandName, ..._args] = interaction.customId.split(":");
			const command = commands.get(commandName);
			if (!command || !command.modalExecute) return;
			try {
				await command.modalExecute(client, interaction);
			} catch (error) {
				logger.error(
					`there was an error while executing modal with customId ${interaction.customId}`,
					error,
				);
				await interaction.reply({
					content: "there was an error while executing this modal!",
					flags: ["Ephemeral"],
				});
			}
		} else if (interaction.isAutocomplete()) {
			const command = commands.get(interaction.commandName);
			if (!command || !command.autocomplete) return;
			try {
				await command.autocomplete(interaction);
			} catch (error) {
				logger.error(
					`there was an error while executing autocomplete command for ${interaction.commandName}`,
					error,
				);
			}
		} else if (interaction.isStringSelectMenu()) {
			const command = commands.get(interaction.customId.split(":")[0]);
			if (!command || !command.selectMenuExecute)
				return interaction.reply({
					content: "couldn't find the associated command!",
					flags: ["Ephemeral"],
				});
			try {
				await command.selectMenuExecute(client, interaction);
			} catch (error) {
				logger.error(
					`there was an error while executing select menu with customId ${interaction.customId}`,
					error,
				);
				await interaction.reply({
					content: "there was an error while executing this select menu!",
					flags: ["Ephemeral"],
				});
			}
		}
	},
};
