import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type Client,
	ContainerBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	SlashCommandBuilder,
	TextDisplayBuilder,
	escapeMarkdown,
} from "discord.js";

import { getRobloxUser, searchRobloxUsers } from "@/utils/roblox";
import { formatUserInfo } from "@/utils/userInfo";

const commandData = new SlashCommandBuilder()
	.setName("search")
	.setDescription("search for roblox users")
	.addStringOption((option) =>
		option
			.setName("query")
			.setDescription("the username to search for")
			.setRequired(true),
	)
	.addIntegerOption((option) =>
		option
			.setName("limit")
			.setDescription("number of results to show (1-25)")
			.setMinValue(1)
			.setMaxValue(25)
			.setRequired(false),
	);

async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
) {
	const query = interaction.options.getString("query", true);
	const limit = interaction.options.getInteger("limit") || 10;

	await interaction.deferReply();

	const {
		users: usersResult,
		error,
		code,
	} = await searchRobloxUsers(query, limit);

	if (error) {
		if (code === 429)
			return interaction.editReply({
				content: "❌ ran into a rate limit, wait a minute or so and retry",
			});

		return interaction.editReply({
			content: `❌ error while searching: ${error}`,
		});
	}

	if (usersResult.length === 0) {
		await interaction.editReply({
			content: `❌ no users found for "${query}"`,
		});
		return;
	}

	const userContainers = Promise.all(
		usersResult.map(async (user) => {
			const userId = user.id;
			const userResult = await getRobloxUser(String(userId), 75);
			if (!userResult) return null;

			const container = new ContainerBuilder().setAccentColor([203, 166, 247]);
			const avatarParent = new MediaGalleryBuilder();
			const avatar = userResult.thumbnail.done
				? new MediaGalleryItemBuilder().setURL(
						userResult.thumbnail.response.imageUri,
					)
				: null;

			const title = new TextDisplayBuilder().setContent(
				`## ${userResult.user.name} (${userResult.user.id})`,
			);

			const description = new TextDisplayBuilder().setContent(
				escapeMarkdown(userResult.user.about || "no description provided"),
			);

			const profileLink = new ButtonBuilder()
				.setLabel("view profile")
				.setStyle(ButtonStyle.Link)
				.setURL(`https://www.roblox.com/users/${userResult.user.id}/profile`);
			const showMore = new ButtonBuilder()
				.setLabel("show more")
				.setStyle(ButtonStyle.Primary)
				.setCustomId(`search:${userResult.user.id}`);

			const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				profileLink,
				showMore,
			);

			if (avatar)
				container.addMediaGalleryComponents(avatarParent.addItems(avatar));
			container.addTextDisplayComponents(title, description);
			container.addActionRowComponents(actionRow);

			return container;
		}),
	);

	const usersData = await userContainers;
	const nonNull = usersData.filter((userData) => userData !== null);

	const MAX_COMPONENTS = 40;
	const MAX_USERS = MAX_COMPONENTS / 8;
	if (nonNull.length > MAX_USERS) nonNull.length = Math.floor(MAX_USERS);

	await interaction.followUp({
		components: nonNull,
		flags: ["IsComponentsV2"],
	});
}

async function buttonExecute(_client: Client, interaction: ButtonInteraction) {
	if (!interaction.isButton()) return;

	const [action, userId] = interaction.customId.split(":");
	if (action !== "search") return;

	const { user, thumbnail } = await getRobloxUser(userId, 420);
	const { embed } = formatUserInfo(
		user,
		thumbnail.done ? thumbnail.response.imageUri : null,
	);

	await interaction.reply({ embeds: [embed], flags: ["Ephemeral"] });
}

export default {
	enabled: true,
	data: commandData,
	execute,
	buttonExecute,
};
