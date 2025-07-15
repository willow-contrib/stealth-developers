import {
	type ChatInputCommandInteraction,
	type Client,
	SlashCommandBuilder,
} from "discord.js";

import config from "@/config";
import { buildBansContainer } from "@/utils/bans";
import { hasManagerPermissions } from "@/utils/permissions";
import {
	getUserInfoFromDiscord,
	getUserInfoFromRoblox,
	getUserInfoFromRobloxUsername,
} from "@/utils/userInfo";

const commandData = new SlashCommandBuilder()
	.setName("user")
	.setDescription("get roblox user information")
	.addSubcommand((subcommand) =>
		subcommand
			.setName("discord")
			.setDescription("get roblox info from a discord user")
			.addUserOption((option) =>
				option
					.setName("user")
					.setDescription("the discord user to look up")
					.setRequired(true),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("roblox")
			.setDescription("get roblox info from a user id or username")
			.addStringOption((option) =>
				option
					.setName("input")
					.setDescription("the roblox user id or username to look up")
					.setRequired(true),
			),
	);

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const subcommand = interaction.options.getSubcommand();

	await interaction.deferReply();

	let result: Awaited<ReturnType<typeof getUserInfoFromDiscord>>;
	if (!interaction.member) {
		await interaction.editReply({
			content: "❌ you must be in a server to use this command.",
		});
		return;
	}

	if (subcommand === "discord") {
		const discordUser = interaction.options.getUser("user", true);
		result = await getUserInfoFromDiscord(discordUser.id, interaction.member);
	} else if (subcommand === "roblox") {
		const input = interaction.options.getString("input", true);

		if (/^\d+$/.test(input)) {
			result = await getUserInfoFromRoblox(input, interaction.member);
		} else {
			result = await getUserInfoFromRobloxUsername(input, interaction.member);
		}
	} else {
		await interaction.editReply({
			content: "❌ unknown subcommand.",
		});
		return;
	}

	if ("error" in result) {
		await interaction.editReply({
			content: `❌ ${result.error}`,
		});
		return;
	}

	await interaction.editReply({
		flags: ["IsComponentsV2"],
		components: [...result.containers, ...result.actionRows],
	});
	await interaction.followUp({
		content: result.user.id,
	});
}

export default {
	enabled: config.data.roblox?.apiKey && (config.data.bloxlink?.token || true),
	data: commandData,
	execute,
};
