import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	ChannelType,
	type ChatInputCommandInteraction,
	type Client,
	EmbedBuilder,
	type GuildMember,
	ModalBuilder,
	type ModalSubmitInteraction,
	SlashCommandBuilder,
	StringSelectMenuBuilder,
	type StringSelectMenuInteraction,
	StringSelectMenuOptionBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";
import {
	BugModel,
	type BugType,
	GuildModel,
	getNextBugId,
} from "../../database/schemas.ts";
import { createUserIfNotExists } from "../../utils/exists.ts";
import { Logger } from "../../utils/logging.ts";
import { hasManagerPermissions } from "../../utils/permissions.ts";

const logger = new Logger("bug-command");

// misc
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

async function updateBugEmbed(
	client: Client,
	bug: BugType,
	messageId: string,
	channelId: string,
) {
	try {
		const channel = await client.channels.fetch(channelId);
		if (!channel?.isTextBased() || !("messages" in channel)) return;

		const message = await channel.messages.fetch(messageId);
		const gameInfo = GAME_MAP[bug.game as keyof typeof GAME_MAP];

		const embed = new EmbedBuilder()
			.setAuthor({
				name: message.embeds[0].author?.name || "unknown user",
				url: message.embeds[0].author?.url,
				iconURL: message.embeds[0].author?.iconURL,
			})
			.setThumbnail(gameInfo.iconURL)
			.setTitle(bug.title)
			.setColor(bug.status === "closed" ? 0x95a5a6 : 0xff6b6b)
			.setDescription(bug.description)
			.setFooter({
				text: `${gameInfo.name} • bug #${bug.bug_id} • ${bug.status}`,
			})
			.setTimestamp();

		// disable buttons if closed
		const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(`bug:close:${bug.bug_id}`)
				.setLabel(bug.status === "closed" ? "reopen" : "close")
				.setStyle(ButtonStyle.Secondary)
				.setEmoji(bug.status === "closed" ? "🔓" : "🔒"),
			new ButtonBuilder()
				.setCustomId(`bug:edit:${bug.bug_id}`)
				.setLabel("edit")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(bug.status === "closed"),
			new ButtonBuilder()
				.setCustomId(`bug:delete:${bug.bug_id}`)
				.setLabel("delete")
				.setStyle(ButtonStyle.Danger),
			new ButtonBuilder()
				.setCustomId("bug:new")
				.setLabel("new bug")
				.setStyle(ButtonStyle.Success),
		);

		await message.edit({ embeds: [embed], components: [buttons] });
	} catch (error) {
		logger.error("failed to update bug embed:", error);
	}
}

// command stuff
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

	const customIdParts = interaction.customId.split(":");
	const title = interaction.fields.getTextInputValue("title");
	const description = interaction.fields.getTextInputValue("description");

	// handle edit case
	if (customIdParts[1] === "edit") {
		const bugId = Number.parseInt(customIdParts[2]);

		try {
			const bug = await BugModel.findOne({ bug_id: bugId });
			if (!bug) {
				return interaction.reply({
					content: "❌ bug not found.",
					flags: ["Ephemeral"],
				});
			}

			bug.title = title;
			bug.description = description;
			await bug.save();

			// check if msg exists & update embed
			if (bug.message_id && interaction.guild) {
				const guild = await GuildModel.findOne({
					guild_id: interaction.guild.id,
				});
				if (guild?.bug_channel) {
					await updateBugEmbed(client, bug, bug.message_id, guild.bug_channel);
				}
			}

			await interaction.reply({
				content: `✅ bug #${bug.bug_id} updated!`,
				flags: ["Ephemeral"],
			});
		} catch (error) {
			logger.error("failed to update bug:", error);
			await interaction.reply({
				content: "❌ failed to update bug. please try again later.",
				flags: ["Ephemeral"],
			});
		}
		return;
	}

	const game = customIdParts[1];

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

					const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId(`bug:close:${bugId}`)
							.setLabel("close")
							.setStyle(ButtonStyle.Secondary)
							.setEmoji("🔒"),
						new ButtonBuilder()
							.setCustomId(`bug:edit:${bugId}`)
							.setLabel("edit")
							.setStyle(ButtonStyle.Primary),
						new ButtonBuilder()
							.setCustomId(`bug:delete:${bugId}`)
							.setLabel("delete")
							.setStyle(ButtonStyle.Danger),
						new ButtonBuilder()
							.setCustomId("bug:new")
							.setLabel("new bug")
							.setStyle(ButtonStyle.Success),
					);

					const message = await channel.send({
						embeds: [embed],
						components: [buttons],
					});

					try {
						const thread = await message.startThread({
							name: `#${bugId}: ${title.substring(0, 50)}${title.length > 50 ? "..." : ""}`,
							reason: `bug report thread for bug #${bugId}`,
						});

						await thread.members.add(interaction.user.id);
						await thread.send({
							content: `thread created for bug #${bugId}. use this space to discuss the bug report, provide additional details, or ask questions.`,
						});

						bug.thread_id = thread.id;
						await bug.save();
					} catch (error) {}

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

async function buttonExecute(client: Client, interaction: ButtonInteraction) {
	const [, action, bugId] = interaction.customId.split(":");

	if (action === "new") {
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId("bug:game-select")
			.setPlaceholder("select a game")
			.addOptions(
				new StringSelectMenuOptionBuilder()
					.setLabel("warfare tycoon")
					.setValue("wft"),
				new StringSelectMenuOptionBuilder()
					.setLabel("ground war")
					.setValue("gw"),
				new StringSelectMenuOptionBuilder()
					.setLabel("airsoft battles")
					.setValue("ab"),
			);

		const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			selectMenu,
		);

		return interaction.reply({
			content: "select a game to report a bug for:",
			components: [row],
			flags: ["Ephemeral"],
		});
	}

	const member = interaction.member as GuildMember;
	const isManager = await hasManagerPermissions(member);

	const bug = await BugModel.findOne({ bug_id: Number.parseInt(bugId) });
	if (!bug) {
		return interaction.reply({
			content: "❌ bug not found.",
			flags: ["Ephemeral"],
		});
	}

	const isAuthor = bug.user_id === interaction.user.id;

	if (!isManager && !isAuthor) {
		return interaction.reply({
			content: "❌ you don't have permission to do this.",
			flags: ["Ephemeral"],
		});
	}

	switch (action) {
		case "close": {
			const newStatus = bug.status === "closed" ? "open" : "closed";
			bug.status = newStatus;
			await bug.save();

			// update the embed
			if (bug.message_id && interaction.guild) {
				const guild = await GuildModel.findOne({
					guild_id: interaction.guild.id,
				});
				if (guild?.bug_channel) {
					await updateBugEmbed(client, bug, bug.message_id, guild.bug_channel);
				}
			}

			await interaction.reply({
				content: `✅ bug #${bug.bug_id} ${newStatus === "closed" ? "closed" : "reopened"}.`,
				flags: ["Ephemeral"],
			});
			break;
		}

		case "edit": {
			if (bug.status === "closed") {
				return interaction.reply({
					content: "❌ cannot edit a closed bug.",
					flags: ["Ephemeral"],
				});
			}

			const modal = new ModalBuilder()
				.setCustomId(`bug:edit:${bug.bug_id}`)
				.setTitle(`edit bug #${bug.bug_id}`);

			const titleInput = new TextInputBuilder()
				.setCustomId("title")
				.setLabel("bug title")
				.setStyle(TextInputStyle.Short)
				.setPlaceholder("short description of the bug")
				.setRequired(true)
				.setMaxLength(100)
				.setValue(bug.title);

			const descriptionInput = new TextInputBuilder()
				.setCustomId("description")
				.setLabel("bug description")
				.setStyle(TextInputStyle.Paragraph)
				.setPlaceholder(
					"detailed description of the bug and steps to reproduce",
				)
				.setRequired(true)
				.setMaxLength(1000)
				.setValue(bug.description);

			const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
				titleInput,
			);
			const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
				descriptionInput,
			);

			modal.addComponents(firstRow, secondRow);
			await interaction.showModal(modal);
			break;
		}

		case "delete": {
			bug.deleteOne();

			// delete the message if it exists
			if (bug.message_id && interaction.guild) {
				const guild = await GuildModel.findOne({
					guild_id: interaction.guild.id,
				});
				if (guild?.bug_channel) {
					try {
						const channel = await client.channels.fetch(guild.bug_channel);
						if (channel?.isTextBased() && "messages" in channel) {
							const message = await channel.messages.fetch(bug.message_id);
							await message.delete();
						}
					} catch (error) {
						logger.error("failed to delete bug message:", error);
					}
				}
			}

			await interaction.reply({
				content: `✅ bug #${bug.bug_id} deleted.`,
				flags: ["Ephemeral"],
			});
			break;
		}
	}
}

async function selectMenuExecute(
	_client: Client,
	interaction: StringSelectMenuInteraction,
) {
	if (interaction.customId !== "bug:game-select") return;

	const game = interaction.values[0];
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

export default {
	data: commandData,
	execute,
	modalExecute,
	buttonExecute,
	selectMenuExecute,
};
