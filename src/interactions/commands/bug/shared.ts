import config from "@/config.ts";
import type { BugType } from "@/database/schemas.ts";
import lily from "@/utils/logging.ts";
import type { Client } from "discord.js";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

export const logger = lily.child("bugShared");
export const PROJECT_MAP = config.data.projects;

export function getProjectName(value: string): string {
	const project = PROJECT_MAP[value as keyof typeof PROJECT_MAP];
	if (!project) return `unknown ${config.data.terminology}`;
	return project.name;
}

export async function updateBugEmbed(
	client: Client,
	bug: BugType,
	messageId: string,
	channelId: string,
): Promise<void> {
	try {
		const channel = await client.channels.fetch(channelId);
		if (!channel?.isTextBased() || !("messages" in channel)) return;

		const message = await channel.messages.fetch(messageId);
		const projectInfo = PROJECT_MAP[bug.project as keyof typeof PROJECT_MAP];

		const embed = new EmbedBuilder()
			.setAuthor({
				name: message.embeds[0].author?.name || "unknown user",
				url: message.embeds[0].author?.url,
				iconURL: message.embeds[0].author?.iconURL,
			})
			.setTitle(bug.title)
			.setColor(bug.status === "closed" ? 0x95a5a6 : 0xff6b6b)
			.setDescription(bug.description)
			.setFooter({
				text: `${projectInfo.name} • bug #${bug.bug_id} • ${bug.status}`,
			})
			.setTimestamp();

		if (projectInfo.iconURL) embed.setThumbnail(projectInfo.iconURL);

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
