import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	type Client,
	ModalBuilder,
	type ModalSubmitInteraction,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import { BugModel, UserModel } from "../../database/schemas.ts";
import { createUserIfNotExists } from "../../utils/exists.ts";
import { Logger } from "../../utils/logging.ts";

const logger = new Logger("bug-command");

const commandData = new SlashCommandBuilder()
	.setName("bug")
	.setDescription("report a bug")
	.addStringOption((option) =>
		option
			.setName("game")
			.setDescription("which game this bug affects")
			.setRequired(true)
			.addChoices(
				{ name: "warfare tycoon", value: "wft" },
				{ name: "ground war", value: "gw" },
				{ name: "airsoft battles", value: "ab" },
			),
	);

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const game = interaction.options.getString("game", true);

	const modal = new ModalBuilder()
		.setCustomId(`bug:${game}`)
		.setTitle(`report bug - ${getGameName(game)}`);

	const titleInput = new TextInputBuilder()
		.setCustomId("title")
		.setLabel("bug title")
		.setStyle(TextInputStyle.Short)
		.setPlaceholder("short description of the bug")
		.setRequired(true)
		.setMaxLength(100);

	const descriptionInput = new TextInputBuilder()
		.setCustomId("description")
		.setLabel("bug description")
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder("detailed description of the bug and steps to reproduce")
		.setRequired(true)
		.setMaxLength(1000);

	const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
		titleInput,
	);
	const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
		descriptionInput,
	);

	modal.addComponents(firstRow, secondRow);

	await interaction.showModal(modal);
}

async function modalExecute(
	_client: Client,
	interaction: ModalSubmitInteraction,
) {
	if (!interaction.guild) {
		await interaction.reply({
			content: "❌ this command can only be used in a server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const [, game] = interaction.customId.split(":");
	const title = interaction.fields.getTextInputValue("title");
	const description = interaction.fields.getTextInputValue("description");

	try {
		await createUserIfNotExists(interaction.user.id, interaction.guild.id);

		const bug = new BugModel({
			user_id: interaction.user.id,
			game,
			title,
			description,
			status: "open",
			sent: false,
		});

		await bug.save();
		logger.info(`bug report created: ${bug._id}`);

		await interaction.reply({
			content: `✅ bug report submitted!\n\n**game:** ${getGameName(game)}\n**title:** ${title}\n**id:** \`${bug._id}\``,
			flags: ["Ephemeral"],
		});
	} catch (error) {
		logger.error("failed to create bug report:", error);
		await interaction.reply({
			content: "❌ failed to submit bug report. please try again later.",
			flags: ["Ephemeral"],
		});
	}
}

function getGameName(value: string): string {
	switch (value) {
		case "wft":
			return "warfare tycoon";
		case "gw":
			return "ground war";
		case "ab":
			return "airsoft battles";
		default:
			return value;
	}
}

export default {
	data: commandData,
	execute,
	modalExecute,
};
