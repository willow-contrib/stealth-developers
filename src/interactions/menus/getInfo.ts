import {
	type ActionRow,
	ApplicationCommandType,
	ButtonBuilder,
	type ButtonComponent,
	ButtonStyle,
	type Client,
	ContextMenuCommandBuilder,
	EmbedBuilder,
	type UserContextMenuCommandInteraction,
} from "discord.js";

import config from "@/config";
import type { GetUserResponse } from "@/types/roblox";
import { getConnectedRobloxUser, getRobloxUser } from "@/utils/roblox";
import { ActionRowBuilder } from "discord.js";

const commandData = new ContextMenuCommandBuilder()
	.setName("get account")
	.setType(ApplicationCommandType.User);

async function execute(
	_client: Client,
	interaction: UserContextMenuCommandInteraction,
) {
	const connectedAccount = await getConnectedRobloxUser(interaction.user.id);
	if ("error" in connectedAccount)
		return interaction.reply({
			content: `error: ${connectedAccount.error}`,
		});

	const { user, thumbnail } = await getRobloxUser(connectedAccount.robloxID);
	const createdAt = new Date(user.createTime);
	const timestamp = Math.floor(createdAt.getTime() / 1000);

	const embed = new EmbedBuilder()
		.setAuthor({
			name: user.displayName,
			url: `https://www.roblox.com/users/${user.id}/profile`,
		})
		.setThumbnail(thumbnail.done ? thumbnail.response.imageUri : "")
		.setDescription(user.about || null)
		.addFields(
			{
				name: "id",
				value: user.id,
			},
			{
				name: "username",
				value: user.name,
			},
			{
				name: "created",
				value: `<t:${timestamp}> (<t:${timestamp}:R>)`,
			},
		)
		.setColor(0x00aaff);

	const buttonRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setURL(`https://www.roblox.com/users/${user.id}/profile`)
			.setLabel("view profile")
			.setStyle(ButtonStyle.Link),
	) as unknown as ActionRow<ButtonComponent>;

	await interaction.reply({
		embeds: [embed],
		components: [buttonRow],
	});
}

export default {
	enabled: config.data.bloxlink?.token && config.data.roblox?.apiKey,
	data: commandData,
	execute,
};
