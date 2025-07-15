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
	if (!interaction.member) {
		await interaction.reply({
			content: "❌ you must be in a server to use this command.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const result = await getUserInfoFromDiscord(
		interaction.targetId,
		interaction.member,
	);

	if ("error" in result) {
		return interaction.reply({
			content: `❌ ${result.error}`,
			flags: ["Ephemeral"],
		});
	}

	await interaction.reply({
		flags: ["IsComponentsV2"],
		components: [...result.containers, ...result.actionRows],
	});
	await interaction.followUp({ content: result.user.id });
}

export default {
	enabled: config.data.bloxlink?.token && config.data.roblox?.apiKey,
	data: commandData,
	execute,
};
