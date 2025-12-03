import { GuildModel } from "@/database/schemas";
import lily from "@/utils/logging";
import { hasManagerPermissions } from "@/utils/permissions";
import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	type Client,
	type GuildMember,
	LabelBuilder,
	ModalBuilder,
	type ModalSubmitInteraction,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

const logger = lily.child("messageCommand");

const MODAL_ID = "message:report_message";
const INPUT_ID = "message_content";

const commandData = new SlashCommandBuilder()
	.setName("message")
	.setDescription("set the custom report message shown in this server");

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild || !interaction.member) {
		await interaction.reply({
			content: "❌ this command can only be used in a server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const isManager = await hasManagerPermissions(
		interaction.member as GuildMember,
	);
	if (!isManager) {
		await interaction.reply({
			content: "❌ you do not have permission to manage this server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	try {
		const guildData = await GuildModel.findOne({
			guild_id: interaction.guild.id,
		});

		const currentMessage = guildData?.report_message || "";

		const modal = new ModalBuilder()
			.setCustomId(MODAL_ID)
			.setTitle("Edit Report Message");

		const label = new LabelBuilder()
			.setLabel("Report Message Content")
			.setDescription("This will be the message shown to first time reporters.")
			.setTextInputComponent(
				new TextInputBuilder()
					.setCustomId(INPUT_ID)
					.setPlaceholder("meow meow :3")
					.setStyle(TextInputStyle.Paragraph)
					.setMaxLength(2000)
					.setRequired(true)
					.setValue(currentMessage),
			);

		modal.addLabelComponents(label);
		await interaction.showModal(modal);
	} catch (error) {
		logger.error("failed to open message modal:", error);
		await interaction.reply({
			content: "❌ an error occurred while trying to open the configuration.",
			flags: ["Ephemeral"],
		});
	}
}

async function modalExecute(
	_client: Client,
	interaction: ModalSubmitInteraction,
) {
	console.log("modalExecute called");
	if (interaction.customId !== MODAL_ID) return;

	if (!interaction.guild) {
		await interaction.reply({
			content: "❌ this command can only be used in a server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		const newMessage = interaction.fields.getTextInputValue(INPUT_ID);

		await GuildModel.findOneAndUpdate(
			{ guild_id: interaction.guild.id },
			{ report_message: newMessage },
			{ upsert: true, new: true },
		);

		logger.info(
			`updated report message for guild ${interaction.guild.id} by ${interaction.user.id}`,
		);

		await interaction.editReply({
			content: "✅ report message updated successfully.",
		});
	} catch (error) {
		logger.error("failed to save report message:", error);
		await interaction.editReply({
			content: "❌ failed to save the report message. please try again later.",
		});
	}
}

export default {
	data: commandData,
	execute,
	modalExecute,
};
