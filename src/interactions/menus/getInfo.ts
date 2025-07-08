import {
	ApplicationCommandType,
	type Client,
	ContextMenuCommandBuilder,
	type UserContextMenuCommandInteraction,
} from "discord.js";

import config from "@/config";
import { getUserInfoFromDiscord } from "@/utils/userInfo";

const commandData = new ContextMenuCommandBuilder()
	.setName("get account")
	.setType(ApplicationCommandType.User);

async function execute(
	_client: Client,
	interaction: UserContextMenuCommandInteraction,
) {
	const result = await getUserInfoFromDiscord(interaction.targetId);

	if ("error" in result) {
		return interaction.reply({
			content: `❌ ${result.error}`,
			flags: ["Ephemeral"],
		});
	}

	await interaction.reply({
		embeds: [result.embed],
		components: result.components,
	});
}

export default {
	enabled: config.data.bloxlink?.token && config.data.roblox?.apiKey,
	data: commandData,
	execute,
};
