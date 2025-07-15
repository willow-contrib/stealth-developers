import config from "@/config";
import type { Post } from "@/types/forums";
import { Logger } from "@sillowww/lily";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Client,
	ContainerBuilder,
	type GuildTextBasedChannel,
	REST,
	Routes,
	TextDisplayBuilder,
	inlineCode,
} from "discord.js";
import { buildBansContainer } from "./bans";
import { getRobloxUser } from "./roblox";

const startTime = Date.now();
const seenPosts = new Set<string>();
const forumConfig = config.data.roblox?.forumWatcher;
const logger = new Logger("ForumWatcher");

export function isNewPost(post: Post): boolean {
	const postId = post.id.toString();
	let isNew = true;

	isNew = !seenPosts.has(postId);
	if (isNew) seenPosts.add(postId);

	if (new Date(post.createdAt).getTime() < startTime) isNew = false;
	return isNew;
}

async function fetchPosts(): Promise<Post[]> {
	if (!forumConfig)
		throw new Error("the forum watcher is not enabled in the configuration.");

	const response = await fetch(
		`https://groups.roblox.com/v1/groups/${forumConfig.groupId}/forums/${forumConfig.channelId}/posts`,
		{
			headers: {
				Cookie: config.data.roblox?.cookie || "",
			},
		},
	);

	if (!response.ok) {
		logger.error(
			`failed to fetch posts: ${response.status} ${response.statusText}`,
		);
		throw new Error("failed to fetch posts from the forum.");
	}

	const data = await response.json();
	if (!data || !Array.isArray(data.data)) {
		logger.error("invalid response format from the forum API.");
		throw new Error("invalid response format from the forum API.");
	}

	return data.data as Post[];
}

function inlineLink(text: string, link: string): string {
	return `[${text}](${link})`;
}

export async function uploadThumbnailAsEmoji(
	client: Client | null,
	imageUrl: string,
	name: string,
) {
	const rest = new REST({ version: "10" }).setToken(config.data.discord.token);
	const imageResponse = await fetch(imageUrl);
	if (!imageResponse.ok) {
		logger.error(`failed to fetch image from ${imageUrl}`);
		return null;
	}

	const appId = config.data.discord.app_id;

	const imageBuffer = await imageResponse.arrayBuffer();

	if (imageBuffer.byteLength > 256 * 1024) {
		logger.warn("avatar image too large, skipping");
		return null;
	}

	const base64Image = Buffer.from(imageBuffer).toString("base64");
	const imageData = `data:image/png;base64,${base64Image}`;

	try {
		const randomId = Math.floor(Math.random() * 1000000);
		client;
		const emoji = await rest.post(Routes.applicationEmojis(appId), {
			body: {
				name: `${name}_avatar_${randomId}`,
				image: imageData,
			},
		});

		return emoji as { id: string; name: string };
	} catch (_err) {
		logger.error(`failed to upload emoji for ${name}: ${_err}`);
		if (_err instanceof Error) {
			logger.error(`error details: ${_err.message}`);
		} else logger.error("unknown error occurred while uploading emoji.");
	}

	return null;
}

export async function watchForum(client: Client) {
	if (!forumConfig || !forumConfig.enabled) return;
	const channelId = forumConfig.notificationChannelId;
	const channel = client.channels.cache.get(channelId) as GuildTextBasedChannel;

	if (!channel || !channel.isTextBased()) {
		logger.error(
			`notification channel with ID ${channelId} is not a valid text channel.`,
		);
		return;
	}

	try {
		const posts = await fetchPosts();
		const newPosts = posts.filter(isNewPost);

		const flaggedWords = [
			"ban",
			"appeal",
			"hacker",
			"exploit",
			"cheater",
			"unban",
			"moderator",
			"admin",
			"mod",
			"exploiters",
			"exploits",
		];

		for (const post of newPosts) {
			const includesWord = flaggedWords.some((word) =>
				post.name.toLowerCase().includes(word),
			);
			if (!includesWord) continue;
			const postLink = `https://roblox.com/communities/${forumConfig.groupId}/${forumConfig.groupName}#!/forums/${forumConfig.channelId}/post/${post.id}`;
			const postContainer = new ContainerBuilder();

			const { user, thumbnail } = await getRobloxUser(
				String(post.createdBy),
				48,
			);

			let emoji: { id: string; name: string } | null = null;

			{
				if (thumbnail.done) {
					emoji = await uploadThumbnailAsEmoji(
						client,
						thumbnail.response.imageUri,
						user.displayName || user.name,
					);
				}

				const postTitle = new TextDisplayBuilder().setContent(
					`## ${post.name}`,
				);
				const postDescription = new TextDisplayBuilder().setContent(
					post.firstComment.content.plainText || "no description provided",
				);
				const postAuthor = new TextDisplayBuilder().setContent(
					[
						emoji ? `<:${emoji.name}:${emoji.id}>` : "",
						`**${inlineLink(user.displayName || user.name, `https://www.roblox.com/users/${user.id}/profile`)}**`,
					].join(" "),
				);

				const footerParts = [
					`user id: ${inlineCode(String(post.createdBy))}`,
					`posted <t:${Math.round(new Date(post.createdAt).getTime() / 1000)}:R>`,
				];
				const postFooter = new TextDisplayBuilder().setContent(
					`-# ${footerParts.join(" • ")}`,
				);

				postContainer.addTextDisplayComponents(
					postAuthor,
					postTitle,
					postDescription,
					postFooter,
				);
			}

			const bansContainer = await buildBansContainer(user);
			const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("view post")
					.setStyle(ButtonStyle.Link)
					.setURL(postLink),
			);

			await channel.send({
				flags: ["IsComponentsV2"],
				components: [postContainer, bansContainer, buttonRow],
			});
		}
	} catch (error) {
		logger.error(`error while fetching forum posts: ${error}`);
	}
}
