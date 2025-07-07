import config from "@/config";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type Client,
	ContainerBuilder,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from "discord.js";

import { getProjectChoices } from "@/utils/choices";
import { formatTime } from "@/utils/time";

const commandData = new SlashCommandBuilder()
	.setName("codes")
	.setDescription(`get the codes for the associated ${config.data.terminology}`)
	.addStringOption((option) =>
		option
			.setName(config.data.terminology)
			.setDescription("the project to get the codes for")
			.setRequired(true)
			.addChoices(getProjectChoices()),
	)
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("the user to send the codes to")
			.setRequired(false),
	);

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const projectKey = interaction.options.getString(
		config.data.terminology,
		true,
	);
	const project = config.data.projects[projectKey];

	if (!project) {
		return interaction.reply({
			content: `couldn't find data for ${config.data.terminology} "${projectKey}"`,
			flags: ["Ephemeral"],
		});
	}

	const codes = project.codes || [];
	const container = new ContainerBuilder();
	const user = interaction.options.getUser("user");
	const p2 = user ? `• <@${user.id}>` : "";

	if (codes.length === 0) {
		const textComponents = [
			new TextDisplayBuilder().setContent(
				`# no codes for ${project.displayName}`,
			),
			new TextDisplayBuilder().setContent(
				`there aren't any known codes for this ${config.data.terminology} at the moment`,
			),
		];

		const footerComponent = new TextDisplayBuilder().setContent(
			`please tell <@${config.data.developerId}> if this is incorrect ${p2}`,
		);

		container.addTextDisplayComponents(textComponents);
		container.addTextDisplayComponents(footerComponent);
		return interaction.reply({
			components: [container],
			flags: ["IsComponentsV2"],
			...(user
				? { allowedMentions: { users: [user?.id] } }
				: { allowedMentions: { users: [] } }),
		});
	}

	{
		const codeButtons = codes.map((code) =>
			new ButtonBuilder()
				.setCustomId(`codes:${projectKey}:${code.code}`)
				.setLabel(code.code)
				.setStyle(code.expired ? ButtonStyle.Danger : ButtonStyle.Success),
		);

		const buttonRows: ActionRowBuilder<ButtonBuilder>[] = [];
		for (let i = 0; i < codeButtons.length; i += 4) {
			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				codeButtons.slice(i, i + 4),
			);
			buttonRows.push(row);
		}

		const textComponent = new TextDisplayBuilder().setContent(
			`# codes for ${project.displayName}`,
		);

		const footerComponent = new TextDisplayBuilder().setContent(
			`please tell <@${config.data.developerId}> if any any missing or expired codes ${p2}`,
		);

		container.addTextDisplayComponents(textComponent);
		container.addActionRowComponents(buttonRows);
		container.addTextDisplayComponents(footerComponent);
	}

	return interaction.reply({
		components: [container],
		flags: ["IsComponentsV2"],
		...(user
			? { allowedMentions: { users: [user?.id] } }
			: { allowedMentions: { users: [] } }),
	});
}

async function buttonExecute(client: Client, interaction: ButtonInteraction) {
	const [, project, code] = interaction.customId.split(":");
	if (!project || !code) {
		return interaction.reply({
			content: `invalid code button interaction, missing either ${config.data.terminology} or code`,
			flags: ["Ephemeral"],
		});
	}

	const projectData = config.data.projects[project];
	if (!projectData) {
		return interaction.reply({
			content: `couldn't find data for ${config.data.terminology} "${project}"`,
			flags: ["Ephemeral"],
		});
	}

	const codeData = projectData.codes?.find((c) => c.code === code);
	if (!codeData) {
		return interaction.reply({
			content: `couldn't find code "${code}" for ${config.data.terminology} "${project}"`,
			flags: ["Ephemeral"],
		});
	}

	return interaction.reply({
		content: `\`${codeData.code}\``,
		flags: ["Ephemeral"],
		components: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("disabled:0")
					.setLabel(codeData.expired ? "expired" : "active")
					.setStyle(codeData.expired ? ButtonStyle.Danger : ButtonStyle.Success)
					.setDisabled(true),
				new ButtonBuilder()
					.setCustomId("disabled:1")
					.setLabel(
						codeData.addedAt
							? `added at ${formatTime(codeData.addedAt)}`
							: "added at unknown time",
					)
					.setStyle(ButtonStyle.Secondary)
					.setDisabled(true),
			),
		],
	});
}

export default {
	data: commandData,
	execute,
	buttonExecute,
};
