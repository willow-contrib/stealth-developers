import config from "@/config.ts";
import type { ICommand } from "@/types.ts";
import {
	type ApplicationCommandData,
	type ButtonInteraction,
	type Client,
	SlashCommandBuilder,
} from "discord.js";
import { buttonCommand } from "./button.ts";
import {
	handleCloseButton,
	handleDeleteButton,
	handleEditButton,
	handleOpenButton,
} from "./buttons.ts";
import { reportCommand } from "./report.ts";

const commandData = new SlashCommandBuilder()
	.setName("bug")
	.setDescription("bug report management")
	.addSubcommand((subcommand) =>
		subcommand.setName("report").setDescription("report a new bug"),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("button")
			.setDescription("create a button to report bugs")
			.addUserOption((option) =>
				option
					.setName("user")
					.setDescription("the user to send the button to")
					.setRequired(true),
			),
	);

async function buttonExecute(client: Client, interaction: ButtonInteraction) {
	const [, action] = interaction.customId.split(":");

	switch (action) {
		case "close":
			await handleCloseButton(client, interaction);
			break;
		case "open":
			await handleOpenButton(client, interaction);
			break;
		case "edit":
			await handleEditButton(client, interaction);
			break;
		case "delete":
			await handleDeleteButton(client, interaction);
			break;
		default:
			await interaction.reply({
				content: "❌ Unknown button action.",
				flags: ["Ephemeral"],
			});
	}
}

export default {
	data: commandData.toJSON() as ApplicationCommandData,
	execute: async (client, interaction) => {
		if (!interaction.isChatInputCommand()) return;

		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case "report":
				await reportCommand.execute(client, interaction);
				break;
			case "button":
				await buttonCommand.execute(client, interaction);
				break;
			default:
				await interaction.reply({
					content: "❌ unknown subcommand.",
					flags: ["Ephemeral"],
				});
		}
	},
	modalExecute: reportCommand.modalExecute,
	buttonExecute,
} satisfies ICommand;
