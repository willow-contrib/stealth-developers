import { GuildModel } from "@/database/schemas";
import lily from "@/utils/logging";
import {
	ApplicationCommandType,
	type Attachment,
	type Client,
	ContextMenuCommandBuilder,
	type GuildTextBasedChannel,
	type MessageContextMenuCommandInteraction,
} from "discord.js";

const logger = lily.child("highlightMenu");

const commandData = new ContextMenuCommandBuilder()
	.setName("highlight")
	.setType(ApplicationCommandType.Message);

function extractVideoLinks(message: { content: string }): string[] {
	const urlRegex =
		/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|medal\.tv\/(?:games\/[\w-]+\/clips\/[\w-]+|g\/[\w-]+|clips\/[\w-]+))/gi;
	return Array.from(message.content.matchAll(urlRegex)).map((m) => m[0]);
}

function isVideoAttachment(attachment: Attachment): boolean {
	return (
		typeof attachment.contentType === "string" &&
		attachment.contentType.startsWith("video/")
	);
}

async function execute(
	client: Client,
	interaction: MessageContextMenuCommandInteraction,
) {
	if (!interaction.guild) {
		await interaction.reply({
			content: "❌ this command can only be used in a server.",
			ephemeral: true,
		});
		return;
	}

	await interaction.deferReply({ flags: ["Ephemeral"] });
	const guildConfig = await GuildModel.findOne({
		guild_id: interaction.guild.id,
	});
	if (!guildConfig?.highlights_channel) {
		await interaction.editReply({
			content:
				"❌ no highlights channel configured. Use `/config highlight-channel`.",
		});
		return;
	}

	const targetMessage = interaction.targetMessage;
	if (!targetMessage) {
		await interaction.editReply({
			content: "❌ couldn't find the target message.",
		});
		return;
	}

	const videoAttachments = targetMessage.attachments.filter(isVideoAttachment);
	const videoLinks = extractVideoLinks(targetMessage);

	if (videoAttachments.size === 0 && videoLinks.length === 0) {
		await interaction.editReply({
			content:
				"❌ no video attachments or supported links found in this message.",
		});
		return;
	}

	let highlightsChannel: GuildTextBasedChannel | null = null;
	try {
		highlightsChannel = (await client.channels.fetch(
			guildConfig.highlights_channel,
		)) as GuildTextBasedChannel | null;
	} catch (e) {
		logger.error("failed to fetch highlights channel:", e);
		await interaction.editReply({
			content: "❌ could not access the highlights channel.",
		});
		return;
	}

	if (!highlightsChannel) {
		await interaction.editReply({
			content: "❌ highlights channel not found.",
		});
		return;
	}

	const files = Array.from(videoAttachments.values()).map((a) => a.url);
	const author = `<@${targetMessage.author.id}>`;
	const jumpUrl = targetMessage.url;

	const videoLinksText = videoLinks
		.map((link) => `• [video Link](${link})`)
		.join(" ");
	const description = `:star: new highlight from ${author}!\n-# [jump to message](${jumpUrl}) ${videoLinksText}`;

	try {
		const msg = await highlightsChannel.send({
			content: description,
			files: files.length > 0 ? files : undefined,
			allowedMentions: { users: [targetMessage.author.id] },
		});

		await msg.react("⭐");
		await interaction.editReply({
			content: "✅ highlight sent!",
		});
	} catch (error) {
		logger.error("failed to send highlight:", error);
		await interaction.editReply({
			content: "❌ failed to send highlight.",
		});
	}
}

export default {
	data: commandData,
	execute,
};
