import {
	ChannelType,
	type ChatInputCommandInteraction,
	type Client,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from "discord.js";
import { GuildModel, type GuildType } from "../../database/schemas.ts";
import { Logger } from "../../utils/logging.ts";

const logger = new Logger("config-command");

const commandData = new SlashCommandBuilder()
	.setName("config")
	.setDescription("configure bot settings for this server")
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("manager-role")
			.setDescription("manage roles that can manage bug reports")
			.addStringOption((option) =>
				option
					.setName("action")
					.setDescription("action to perform")
					.setRequired(true)
					.addChoices(
						{ name: "add", value: "add" },
						{ name: "remove", value: "remove" },
						{ name: "list", value: "list" },
					),
			)
			.addRoleOption((option) =>
				option
					.setName("role")
					.setDescription("role to add/remove")
					.setRequired(false),
			),
	)
	.addSubcommand((subcommand) =>
		subcommand
			.setName("bug-channel")
			.setDescription("set the channel where bug reports are sent")
			.addChannelOption((option) =>
				option
					.setName("channel")
					.setDescription("channel for bug reports")
					.setRequired(true),
			),
	);

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	if (!interaction.guild) {
		await interaction.reply({
			content: "❌ this command can only be used in a server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const subcommand = interaction.options.getSubcommand();

	try {
		let guild = await GuildModel.findOne({
			guild_id: interaction.guild.id,
		});

		if (!guild) {
			guild = new GuildModel({
				guild_id: interaction.guild.id,
				manager_roles: [],
			});
			await guild.save();
			logger.info(`created new guild record for ${interaction.guild.id}`);
		}

		if (subcommand === "manager-role") {
			await handleManagerRole(interaction, guild);
		} else if (subcommand === "bug-channel") {
			await handleBugChannel(interaction, guild);
		}
	} catch (error) {
		logger.error("failed to execute config command:", error);
		await interaction.reply({
			content: "❌ failed to update configuration. please try again later.",
			flags: ["Ephemeral"],
		});
	}
}

async function handleManagerRole(
	interaction: ChatInputCommandInteraction,
	guild: GuildType,
) {
	const action = interaction.options.getString("action", true);
	const role = interaction.options.getRole("role");

	if (action === "list") {
		if (guild.manager_roles.length === 0) {
			await interaction.reply({
				content: "📋 no manager roles configured.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const roleList = guild.manager_roles
			.map((roleId: string) => `<@&${roleId}>`)
			.join("\n");

		await interaction.reply({
			content: `📋 **manager roles:**\n${roleList}`,
			flags: ["Ephemeral"],
		});
		return;
	}

	if (!role) {
		await interaction.reply({
			content: "❌ you must specify a role for this action.",
			flags: ["Ephemeral"],
		});
		return;
	}

	if (action === "add") {
		if (guild.manager_roles.includes(role.id)) {
			await interaction.reply({
				content: `❌ ${role} is already a manager role.`,
				flags: ["Ephemeral"],
			});
			return;
		}

		guild.manager_roles.push(role.id);
		await guild.save();

		await interaction.reply({
			content: `✅ added ${role} as a manager role.`,
			flags: ["Ephemeral"],
		});
	} else if (action === "remove") {
		const index = guild.manager_roles.indexOf(role.id);
		if (index === -1) {
			await interaction.reply({
				content: `❌ ${role} is not a manager role.`,
				flags: ["Ephemeral"],
			});
			return;
		}

		guild.manager_roles.splice(index, 1);
		await guild.save();

		await interaction.reply({
			content: `✅ removed ${role} from manager roles.`,
			flags: ["Ephemeral"],
		});
	}
}

async function handleBugChannel(
	interaction: ChatInputCommandInteraction,
	guild: GuildType,
) {
	const channel = interaction.options.getChannel("channel", true);

	if (channel.type !== ChannelType.GuildText) {
		await interaction.reply({
			content: "❌ bug channel must be a text channel.",
			flags: ["Ephemeral"],
		});
		return;
	}

	guild.bug_channel = channel.id;
	await guild.save();

	await interaction.reply({
		content: `✅ set bug reports channel to ${channel}.`,
		flags: ["Ephemeral"],
	});
}

export default {
	data: commandData,
	execute,
};
