import config from "@/config.ts";
import { BugModel, GuildModel, MediaModel } from "@/database/schemas.ts";
import lily from "@/utils/logging.ts";
import { hasManagerPermissions } from "@/utils/permissions";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	ChannelType,
	type Client,
	type GuildMember,
} from "discord.js";

const logger = lily.child("bugButtons");

export function buildTrelloUrl(title: string, url: string): string {
	const params = new URLSearchParams({
		name: title,
		url: url,
		idBoard: config.data?.trelloBoardId || "",
	});
	return `https://trello.com/addCard?${params.toString()}`;
}

export function buildButtonRow(
	bugId: number,
	messageUrl: string,
	bugTitle: string,
	isClosed: boolean,
): ActionRowBuilder<ButtonBuilder> {
	const row = new ActionRowBuilder<ButtonBuilder>();

	if (isClosed) {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`bug:open:${bugId}`)
				.setLabel("open")
				.setStyle(ButtonStyle.Secondary),
		);
	} else {
		row.addComponents(
			new ButtonBuilder()
				.setCustomId(`bug:close:${bugId}`)
				.setLabel("close")
				.setStyle(ButtonStyle.Secondary),
		);
	}

	row.addComponents(
		new ButtonBuilder()
			.setCustomId(`bug:edit:${bugId}`)
			.setLabel("edit")
			.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
			.setCustomId(`bug:delete:${bugId}`)
			.setLabel("delete")
			.setStyle(ButtonStyle.Danger),
	);

	if (config.data.trelloBoardId) {
		row.addComponents(
			new ButtonBuilder()
				.setLabel("add to trello")
				.setStyle(ButtonStyle.Link)
				.setURL(buildTrelloUrl(bugTitle, messageUrl)),
		);
	}

	return row;
}

async function canManageBug(
	interaction: ButtonInteraction,
	bugUserId: string,
): Promise<boolean> {
	if (!interaction.guild || !interaction.member) return false;
	if (interaction.user.id === bugUserId) return true;

	const guildData = await GuildModel.findOne({
		guild_id: interaction.guild.id,
	});
	if (!guildData) return false;

	return await hasManagerPermissions(interaction.member as GuildMember);
}

export async function handleCloseButton(
	client: Client,
	interaction: ButtonInteraction,
) {
	const bugId = Number.parseInt(interaction.customId.split(":")[2]);
	const bug = await BugModel.findOne({ bug_id: bugId });

	if (!bug) {
		await interaction.reply({
			content: "❌ Bug report not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const canManage = await canManageBug(interaction, bug.user_id);
	if (!canManage) {
		await interaction.reply({
			content: "❌ You don't have permission to close this bug report.",
			flags: ["Ephemeral"],
		});
		return;
	}

	bug.status = "closed";
	await bug.save();

	if (bug.message_id && bug.thread_id) {
		const thread = await client.channels.fetch(bug.thread_id);
		if (thread?.isThread()) {
			const message = await thread.fetchStarterMessage();
			if (message) {
				const buttonRow = buildButtonRow(bugId, message.url, bug.title, true);
				await message.edit({
					components: [...message.components.slice(0, -1), buttonRow],
				});
			}
		}
	}

	await interaction.reply({
		content: "✅ Bug report closed successfully.",
		flags: ["Ephemeral"],
	});

	logger.info(`Bug #${bugId} closed by ${interaction.user.id}`);
}

export async function handleOpenButton(
	client: Client,
	interaction: ButtonInteraction,
) {
	const bugId = Number.parseInt(interaction.customId.split(":")[2]);
	const bug = await BugModel.findOne({ bug_id: bugId });

	if (!bug) {
		await interaction.reply({
			content: "❌ Bug report not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const canManage = await canManageBug(interaction, bug.user_id);
	if (!canManage) {
		await interaction.reply({
			content: "❌ You don't have permission to reopen this bug report.",
			flags: ["Ephemeral"],
		});
		return;
	}

	bug.status = "open";
	await bug.save();

	if (bug.message_id && bug.thread_id) {
		const thread = await client.channels.fetch(bug.thread_id);
		if (thread?.isThread()) {
			const message = await thread.fetchStarterMessage();
			if (message) {
				const buttonRow = buildButtonRow(bugId, message.url, bug.title, false);
				await message.edit({
					components: [...message.components.slice(0, -1), buttonRow],
				});
			}
		}
	}

	await interaction.reply({
		content: "✅ Bug report reopened successfully.",
		flags: ["Ephemeral"],
	});

	logger.info(`Bug #${bugId} reopened by ${interaction.user.id}`);
}

export async function handleEditButton(
	_client: Client,
	interaction: ButtonInteraction,
) {
	const bugId = Number.parseInt(interaction.customId.split(":")[2]);
	const bug = await BugModel.findOne({ bug_id: bugId });

	if (!bug) {
		await interaction.reply({
			content: "❌ Bug report not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const canManage = await canManageBug(interaction, bug.user_id);
	if (!canManage) {
		await interaction.reply({
			content: "❌ You don't have permission to edit this bug report.",
			flags: ["Ephemeral"],
		});
		return;
	}

	// TODO)) implement edit modal
	await interaction.reply({
		content: "❌ Editing bugs is not implemented yet.",
		flags: ["Ephemeral"],
	});
}

export async function handleDeleteButton(
	client: Client,
	interaction: ButtonInteraction,
) {
	const bugId = Number.parseInt(interaction.customId.split(":")[2]);
	const bug = await BugModel.findOne({ bug_id: bugId });

	if (!bug) {
		await interaction.reply({
			content: "❌ Bug report not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const canManage = await canManageBug(interaction, bug.user_id);
	if (!canManage) {
		await interaction.reply({
			content: "❌ You don't have permission to delete this bug report.",
			flags: ["Ephemeral"],
		});
		return;
	}

	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		// delete associated media
		const media = await MediaModel.find({ bug_id: bugId });
		if (media.length > 0) {
			await MediaModel.deleteMany({ bug_id: bugId });
			logger.info(`deleted ${media.length} media files for bug #${bugId}`);
		}

		// delete associated message & thread
		if (bug.message_id && bug.thread_id) {
			const thread = await client.channels.fetch(bug.thread_id);
			if (thread?.type !== ChannelType.PublicThread) return;

			const message = await thread.fetchStarterMessage();
			if (message) await message.delete();

			try {
				await thread.delete(
					`bug report #${bugId} deleted by ${interaction.user.username}`,
				);
			} catch (threadError) {
				logger.warn(`Failed to delete thread for bug #${bugId}:`, threadError);
			}
		}

		// tombstone
		bug.status = "closed";
		bug.title = "[DELETED]";
		bug.description = "[DELETED]";
		await bug.save();

		await interaction.editReply({
			content: "✅ Bug report deleted successfully.",
		});

		logger.info(`Bug #${bugId} deleted by ${interaction.user.id}`);
	} catch (error) {
		logger.error(`Failed to delete bug #${bugId}:`, error);
		await interaction.editReply({
			content: "❌ Failed to delete bug report. Please try again later.",
		});
	}
}
