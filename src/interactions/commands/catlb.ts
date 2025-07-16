import { UserModel } from "@/database/schemas";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type Client,
	ContainerBuilder,
	SeparatorBuilder,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from "discord.js";

const PAGE_SIZE = 10;

const commandData = new SlashCommandBuilder()
	.setName("cat-leaderboard")
	.setDescription("show the top cat point earners in this server");

type SessionState = {
	userId: string;
	currentPage: number;
	pageCount: number;
	userIds: string[];
};

const sessionStore = new Map<string, SessionState>();

function makeSessionId(): string {
	return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeButtonRow(
	sessionId: string,
	currentPage: number,
	pageCount: number,
) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(`cat-leaderboard:prev:${sessionId}`)
			.setLabel("previous")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(currentPage === 1),

		new ButtonBuilder()
			.setCustomId(`cat-leaderboard:next:${sessionId}`)
			.setLabel("next")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(currentPage === pageCount || pageCount === 0),
	);
}

function buildLeaderboardContainer(
	users: { user_id: string; cat_points: number }[],
	currentPage: number,
	pageCount: number,
) {
	const startRank = (currentPage - 1) * PAGE_SIZE + 1;
	const lines = users.map(
		(user, i) =>
			`${startRank + i}. <@${user.user_id}> — ${user.cat_points} cat point${user.cat_points === 1 ? "" : "s"}`,
	);

	const container = new ContainerBuilder()
		.setAccentColor([245, 197, 66])
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent("# 🐱 cat points leaderboard"),
			new TextDisplayBuilder().setContent(
				lines.length > 0
					? lines.join("\n")
					: "no cat points have been awarded yet!",
			),
		)
		.addSeparatorComponents(
			new SeparatorBuilder().setDivider(false).setSpacing(1),
		)
		.addTextDisplayComponents(
			new TextDisplayBuilder().setContent(
				`-# page ${currentPage} of ${pageCount} • last updated: <t:${Math.floor(Date.now() / 1000)}:R>`,
			),
		);

	return container;
}

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

	const allUsers = await UserModel.find({ guild_id: interaction.guild.id })
		.sort({ cat_points: -1, user_id: 1 })
		.select("user_id cat_points")
		.lean();

	const pageCount = Math.max(1, Math.ceil(allUsers.length / PAGE_SIZE));
	const currentPage = 1;
	const users = allUsers.slice(0, PAGE_SIZE);

	const sessionId = makeSessionId();
	sessionStore.set(sessionId, {
		userId: interaction.user.id,
		currentPage,
		pageCount,
		userIds: allUsers.map((u) => u.user_id),
	});

	const container = buildLeaderboardContainer(users, currentPage, pageCount);
	const actions = makeButtonRow(sessionId, currentPage, pageCount);

	await interaction.reply({
		flags: ["IsComponentsV2"],
		components: [container, actions],
		allowedMentions: { users: [] },
	});
}

async function buttonExecute(_client: Client, interaction: ButtonInteraction) {
	const [, action, sessionId] = interaction.customId.split(":");
	const session = sessionStore.get(sessionId);

	if (!session) {
		return interaction.reply({
			content:
				"❌ this leaderboard session has expired. Please run the command again.",
			flags: ["Ephemeral"],
		});
	}
	if (interaction.user.id !== session.userId) {
		return interaction.reply({
			content: `❌ only <@${session.userId}> can interact with this leaderboard.`,
			flags: ["Ephemeral"],
		});
	}

	let newPage = session.currentPage;
	if (action === "prev") newPage = Math.max(1, session.currentPage - 1);
	else if (action === "next")
		newPage = Math.min(session.pageCount, session.currentPage + 1);

	if (newPage !== session.currentPage) {
		session.currentPage = newPage;
		sessionStore.set(sessionId, session);

		const allUsers = await UserModel.find({
			guild_id: interaction.guildId,
			cat_points: { $exists: true, $ne: null },
		})
			.sort({ cat_points: -1, user_id: 1 })
			.select("user_id cat_points")
			.lean();

		session.pageCount = Math.max(1, Math.ceil(allUsers.length / PAGE_SIZE));
		const users = allUsers.slice(
			(newPage - 1) * PAGE_SIZE,
			newPage * PAGE_SIZE,
		);

		const container = buildLeaderboardContainer(
			users,
			newPage,
			session.pageCount,
		);
		const actions = makeButtonRow(sessionId, newPage, session.pageCount);

		await interaction.update({
			flags: ["IsComponentsV2"],
			components: [container, actions],
			allowedMentions: { users: [] },
		});
	} else {
		await interaction.deferUpdate();
	}
}

export default {
	data: commandData,
	execute,
	buttonExecute,
};
