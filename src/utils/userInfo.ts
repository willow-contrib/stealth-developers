import type { GetUserResponse } from "@/types/roblox";
import {
	getConnectedRobloxUser,
	getRobloxIdFromUsername,
	getRobloxUser,
} from "@/utils/roblox";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} from "discord.js";

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

export interface UserInfoResult {
	embed: EmbedBuilder;
	components: ActionRowBuilder<ButtonBuilder>[];
}

export async function getUserInfoFromRobloxUsername(
	username: string,
): Promise<UserInfoResult | { error: string }> {
	const robloxId = await getRobloxIdFromUsername(username);

	if (!robloxId) {
		return { error: "user not found or username is invalid" };
	}

	return getUserInfoFromRoblox(robloxId);
}

export async function getUserInfoFromDiscord(
	discordId: string,
): Promise<UserInfoResult | { error: string }> {
	const connectedAccount = await getConnectedRobloxUser(discordId);
	if ("error" in connectedAccount) {
		return { error: connectedAccount.error };
	}

	return getUserInfoFromRoblox(connectedAccount.robloxID);
}

export async function getUserInfoFromRoblox(
	robloxId: string,
	avatarSize: AvatarSize = 420,
): Promise<UserInfoResult | { error: string }> {
	try {
		const { user, thumbnail } = await getRobloxUser(robloxId, avatarSize);
		return formatUserInfo(
			user,
			thumbnail.done ? thumbnail.response.imageUri : null,
		);
	} catch (error) {
		return {
			error:
				error instanceof Error ? error.message : "failed to fetch user data",
		};
	}
}

export function formatUserInfo(
	user: GetUserResponse,
	thumbnailUrl: string | null,
): UserInfoResult {
	const createdAt = new Date(user.createTime);
	const timestamp = Math.floor(createdAt.getTime() / 1000);

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

	if (thumbnailUrl) {
		embed.setThumbnail(thumbnailUrl);
	}

	const components = [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setURL(`https://www.roblox.com/users/${user.id}/profile`)
				.setLabel("view profile")
				.setStyle(ButtonStyle.Link),
		),
	];

	return { embed, components };
}
