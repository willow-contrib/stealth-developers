import type { ChatInputCommandInteraction, Client } from "discord.js";

export async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const tgtUser = interaction.options.getUser("user", true);

	const command = `</bug report:${interaction.commandId}>`;
	await interaction.reply({
		content: `📝 <@${tgtUser.id}>, you can use the ${command} command to report bugs, it will show a popup where you can enter the bug details and attach a relevant piece of media.`,
	});
}

export const helpCommand = {
	execute,
};
