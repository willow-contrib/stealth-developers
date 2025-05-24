import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	type ChatInputCommandInteraction,
	type Client,
	EmbedBuilder,
	ModalBuilder,
	type ModalSubmitInteraction,
	SlashCommandBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import { BugModel, GuildModel, getNextBugId } from "../../database/schemas.ts";
import { createUserIfNotExists } from "../../utils/exists.ts";
import { Logger } from "../../utils/logging.ts";

const logger = new Logger("bug-command");

const GAME_MAP = {
	gw: {
		name: "ground war",
		iconURL:
			"https://tr.rbxcdn.com/180DAY-7f58a11cdd59397e06d2b291326df71b/150/150/Image/Webp/noFilter",
	},
	wft: {
		name: "warfare tycoon",
		iconURL:
			"https://tr.rbxcdn.com/180DAY-ed309245ae50b509504c403a433ec0d2/150/150/Image/Webp/noFilter",
	},
	ab: {
		name: "airsoft battles",
		iconURL:
			"https://tr.rbxcdn.com/180DAY-43ff702ae43b081ec8db160d1a1d6636/150/150/Image/Webp/noFilter",
	},
};

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
	client: Client,
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

		const bugId = await getNextBugId();

		const bug = new BugModel({
			bug_id: bugId,
			user_id: interaction.user.id,
			game,
			title,
			description,
			status: "open",
			sent: false,
		});

		await bug.save();
		logger.info(`bug report created: ${bug._id}`);

		// send to bug channel if configured
		const guild = await GuildModel.findOne({
			guild_id: interaction.guild.id,
		});
		let msgUrl = "";

		if (guild?.bug_channel) {
			try {
				const channel = await client.channels.fetch(guild.bug_channel);
				if (channel?.type !== ChannelType.GuildText) {
					await interaction.reply({
						content: "❌ the bug channel is misconfigured",
					});
				}

				if (channel?.isTextBased() && "send" in channel) {
					const gameInfo = GAME_MAP[game as keyof typeof GAME_MAP];

					const embed = new EmbedBuilder()
						.setAuthor({
							name: interaction.user.displayName,
							url: `https://discord.com/users/${interaction.user.id}`,
							iconURL: interaction.user?.avatarURL() || undefined,
						})
						.setThumbnail(gameInfo.iconURL)
						.setTitle(title)
						.setColor(0xff6b6b)
						.setDescription(description)
						.setFooter({ text: `${gameInfo.name} • bug #${bugId}` })
						.setTimestamp();

					const message = await channel.send({ embeds: [embed] });
					msgUrl = message.url;

					bug.message_id = message.id;
					bug.sent = true;
					await bug.save();

					logger.info(
						`sent bug report ${bug._id} to channel ${guild.bug_channel}`,
					);
				}
			} catch (error) {
				logger.error(`failed to send bug report to channel: ${error}`);
			}
		}

		await interaction.reply({
			content: `✅ bug report submitted! ${msgUrl}`,
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
