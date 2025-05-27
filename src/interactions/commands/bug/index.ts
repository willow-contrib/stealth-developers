import { type ApplicationCommandData, SlashCommandBuilder } from "discord.js";
import type { ICommand } from "../../../types.ts";
import { buttonCommand } from "./button.ts";
import { reportCommand } from "./report.ts";

const commandData = new SlashCommandBuilder()
	.setName("bug")
	.setDescription("bug report management")
	.addSubcommand((subcommand) =>
		subcommand
			.setName("report")
			.setDescription("report a new bug")
			.addStringOption((option) =>
				option
					.setName("project")
					.setDescription("which project this bug affects")
					.setRequired(true)
					.addChoices(...reportCommand.getProjectChoices()),
			),
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
	buttonExecute: reportCommand.buttonExecute,
	selectMenuExecute: reportCommand.selectMenuExecute,
} satisfies ICommand;
