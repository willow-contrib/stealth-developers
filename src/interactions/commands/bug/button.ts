import {
	ActionRowBuilder,
	type ChatInputCommandInteraction,
	type Client,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder,
} from "discord.js";
import { PROJECT_MAP } from "./shared.ts";

export async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const tgtUser = interaction.options.getUser("user", true);

	const options = Object.entries(PROJECT_MAP).map(([key, project]) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(project.displayName)
			.setValue(key),
	);

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId("bug:project-select")
		.setPlaceholder("select a project to report a bug")
		.addOptions(...options);

	const selectRow =
		new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

	await interaction.reply({
		content: `📝 <@${tgtUser.id}>, use the dropdown below to select the project
		  you want to report a bug for. in the future, you can also use the
			</bug report:${interaction.commandId}> command to report bugs.`
			.replace(/\s+/g, " ")
			.trim(),
		components: [selectRow],
	});
}

export const buttonCommand = {
	execute,
};
