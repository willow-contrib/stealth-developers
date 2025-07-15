import type { GetUserResponse } from "@/types/roblox";
import {
	getConnectedRobloxUser,
	getRobloxIdFromUsername,
	getRobloxUser,
} from "@/utils/roblox";
import {
	type APIGuildMember,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	EmbedBuilder,
	type GuildMember,
	TextDisplayBuilder,
} from "discord.js";
import { buildBansContainer } from "./bans";
import { uploadThumbnailAsEmoji } from "./forumWatcher";
import { hasManagerPermissions } from "./permissions";

export type AvatarSize =
	| 48
	| 50
	| 60
	| 75
	| 100
	| 110
	| 150
	| 180
	| 352
	| 420
	| 720;

export type UserInfoResult = {
	user: GetUserResponse;
	embed: EmbedBuilder;
	containers: ContainerBuilder[];
	actionRows: ActionRowBuilder<ButtonBuilder>[];
};

export async function getUserInfoFromRobloxUsername(
	username: string,
	member: GuildMember | APIGuildMember,
): Promise<UserInfoResult | { error: string }> {
	const robloxId = await getRobloxIdFromUsername(username);

	if (!robloxId) {
		return { error: "user not found or username is invalid" };
	}

	return getUserInfoFromRoblox(robloxId, member);
}

export async function getUserInfoFromDiscord(
	discordId: string,
	member: GuildMember | APIGuildMember,
): Promise<UserInfoResult | { error: string }> {
	const connectedAccount = await getConnectedRobloxUser(discordId);
	if ("error" in connectedAccount) {
		return { error: connectedAccount.error };
	}

	return getUserInfoFromRoblox(connectedAccount.robloxID, member);
}

export async function getUserInfoFromRoblox(
	robloxId: string,
	member: GuildMember | APIGuildMember,
	avatarSize: AvatarSize = 420,
): Promise<UserInfoResult | { error: string }> {
	try {
		const { user, thumbnail } = await getRobloxUser(robloxId, avatarSize);

		return formatUserInfo(
			user,
			thumbnail.done ? thumbnail.response.imageUri : null,
			member,
		);
	} catch (error) {
		return {
			error:
				error instanceof Error ? error.message : "failed to fetch user data",
		};
	}
}

export async function formatUserInfo(
	user: GetUserResponse,
	thumbnailUrl: string | null,
	member: GuildMember | APIGuildMember,
): Promise<UserInfoResult> {
	const createdAt = new Date(user.createTime);
	const timestamp = Math.floor(createdAt.getTime() / 1000);
	const hasManagerPerms = await hasManagerPermissions(member);

	const thumbnailEmoji = await uploadThumbnailAsEmoji(
		null,
		thumbnailUrl || "",
		user.displayName || user.name,
	);

	const userContainer = new ContainerBuilder();
	{
		const emojiText = thumbnailEmoji
			? `<:${thumbnailEmoji.name}:${thumbnailEmoji.id}> `
			: "";
		const userTitle = new TextDisplayBuilder().setContent(
			`## ${emojiText} ${user.displayName || user.name}`,
		);
		const userDescription = new TextDisplayBuilder().setContent(
			user.about || "no description provided",
		);
		const userId = new TextDisplayBuilder().setContent(`**id:** ${user.id}`);
		const userUsername = new TextDisplayBuilder().setContent(
			`**username:** ${user.name}`,
		);
		const userCreated = new TextDisplayBuilder().setContent(
			`**created:** <t:${timestamp}> (<t:${timestamp}:R>)`,
		);

		userContainer.addTextDisplayComponents(
			userTitle,
			userDescription,
			userId,
			userUsername,
			userCreated,
		);
	}

	const embed = new EmbedBuilder()
		.setAuthor({
			name: user.displayName,
			url: `https://www.roblox.com/users/${user.id}/profile`,
		})
		.setDescription(user.about || null)
		.addFields(
			{
				name: "id",
				value: user.id,
			},
			{
				name: "username",
				value: user.name,
			},
			{
				name: "created",
				value: `<t:${timestamp}> (<t:${timestamp}:R>)`,
			},
		)
		.setColor(0x00aaff);
	if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
	const bansComponent = await buildBansContainer(user);

	return {
		user: user,
		embed: embed,
		containers: [userContainer, ...(hasManagerPerms ? [bansComponent] : [])],
		actionRows: [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setURL(`https://www.roblox.com/users/${user.id}/profile`)
					.setLabel("view profile")
					.setStyle(ButtonStyle.Link),
			),
		],
	};
}
