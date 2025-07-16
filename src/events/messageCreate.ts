import config from "@/config";
import { UserModel } from "@/database/schemas";
import { logger as _logger } from "@/utils/logging";
import vision from "@google-cloud/vision";
import {
	type Attachment,
	ChannelType,
	type Client,
	Events,
	type Message,
} from "discord.js";

type ImageResult = {
	image: Attachment;
	isCat: boolean;
};

const logger = _logger.child(["google-cloud", "vision"]);

type ImageResults = Record<string, ImageResult>;
const client = new vision.ImageAnnotatorClient({
	projectId: config.data.googleCloud?.projectId,
	credentials: {
		client_email: config.data.googleCloud?.credentials.clientEmail,
		private_key: config.data.googleCloud?.credentials.privateKey,
	},
});

async function processImage(
	message: Message,
): Promise<ImageResults | undefined> {
	if (!config.data.googleCloud) {
		logger.warn("gcp vision api not configured");
		return;
	}

	const imageAttachments = message.attachments.filter((attachment) =>
		attachment.contentType?.startsWith("image/"),
	);

	if (imageAttachments.size === 0) return;

	const results: ImageResults = {};
	for (const [id, attachment] of imageAttachments) {
		try {
			const response = await fetch(attachment.url);
			if (!response.ok) {
				logger.error(`failed to download image ${attachment.url}`);
				results[id] = { image: attachment, isCat: false };
				continue;
			}

			const buffer = await response.arrayBuffer();

			if (client.objectLocalization === undefined) {
				logger.warn(
					"objectLocalization method not available in Google Cloud Vision client",
				);
				return;
			}

			const [result] = await client.objectLocalization({
				image: { content: Buffer.from(buffer) },
			});

			const objects = result.localizedObjectAnnotations || [];
			const hasCat = objects.some(
				(obj) =>
					obj.name?.toLowerCase().includes("cat") && (obj.score || 0) > 0.5,
			);

			results[id] = { image: attachment, isCat: hasCat };
			logger.debug(`image ${attachment.name}: cat detected = ${hasCat}`);
		} catch (error) {
			logger.error(`error processing image ${attachment.name}:`, error);
			results[id] = { image: attachment, isCat: false };
		}
	}

	return results;
}

export default {
	event: Events.MessageCreate,
	async execute(client: Client, message: Message) {
		if (
			!message.attachments.some((attachment) =>
				attachment.contentType?.startsWith("image/"),
			) ||
			!config.data.catChannel?.channelId ||
			message.author.bot
		)
			return;

		if (message.channel.id !== config.data.catChannel.channelId) return;
		const channel = client.channels.cache.get(config.data.catChannel.channelId);
		if (
			!channel ||
			!channel.isTextBased() ||
			channel.type !== ChannelType.GuildText
		)
			return;

		if (!config.data.googleCloud) {
			await message.react("😻");
			await awardCatPoints(
				message.author.id,
				message.guildId,
				message.attachments.size,
			);
			return;
		}

		const results = await processImage(message);
		if (!results) return;

		const allResults = Object.values(results);
		const catImages = allResults.filter((r) => r.isCat);
		const nonCatImages = allResults.filter((r) => !r.isCat);

		if (nonCatImages.length > 0) {
			const replyContent = [
				"this channel is only for cat images!",
				...(allResults.length > 1
					? [`i found ${nonCatImages.length} non-cat images:`]
					: []),
			].join(" ");
			await message.reply({
				content: replyContent,
			});
		} else if (catImages.length > 0) {
			await message.react("😻");
			await awardCatPoints(
				message.author.id,
				message.guildId,
				message.attachments.size,
			);
		}
	},
};

async function awardCatPoints(
	userId: string,
	guildId: string | null,
	points: number,
) {
	if (!guildId) return;
	const user = await UserModel.findOneAndUpdate(
		{ user_id: userId, guild_id: guildId },
		{ $inc: { cat_points: points } },
		{ upsert: true, new: true },
	);
	logger.info(
		`awarded ${points} cat points to user ${userId}, total: ${user.cat_points}`,
	);
}
