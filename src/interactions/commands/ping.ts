import {
	type ChatInputCommandInteraction,
	type Client,
	SlashCommandBuilder,
} from "discord.js";

const commandData = new SlashCommandBuilder()
	.setName("ping")
	.setDescription("ping the bot");

async function execute(
	client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const pingMs = Date.now() - interaction.createdTimestamp;

	const initial = await interaction.reply({
		content: "calc'ing latency information...",
		flags: ["Ephemeral"],
	});

	const roundTripMs = Date.now() - initial.createdTimestamp;
	const wsHeartbeat = client.ws.ping;

	return interaction.editReply({
		content:
			`time to receive was ${pingMs}ms, ` +
			`round trip is ${roundTripMs}ms, ` +
			`ws heartbeat is ${wsHeartbeat}ms, ` +
			`uptime is ${formatUptime(client.uptime || 0)}`,
	});
}

function formatUptime(uptime: number): string {
	const totalSeconds = Math.floor(uptime / 1000);
	const days = Math.floor(totalSeconds / 86400);
	const hours = Math.floor((totalSeconds % 86400) / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts = [];
	if (days > 0) parts.push(`${days}d`);
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

	return parts.join(" ");
}

export default {
	data: commandData,
	execute,
};
