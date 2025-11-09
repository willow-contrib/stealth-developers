import config from "@/config.ts";
import {
	BugModel,
	GuildModel,
	MediaModel,
	type MediaType,
	getNextBugId,
} from "@/database/schemas.ts";
import { createUserIfNotExists } from "@/utils/exists.ts";
import {
	type Attachment,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
	type Client,
	ContainerBuilder,
	FileUploadBuilder,
	LabelBuilder,
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	ModalBuilder,
	type ModalSubmitInteraction,
	type ReadonlyCollection,
	SectionBuilder,
	type Snowflake,
	StringSelectMenuBuilder,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
	ThumbnailBuilder,
} from "discord.js";

import { buildButtonRow } from "./buttons.ts";
import { PROJECT_MAP, logger as lily } from "./shared.ts";

const logger = lily.child("report");

// constants
const INPUT_IDS = {
	AFFECTED: "affectedInput",
	TITLE: "titleInput",
	DESCRIPTION: "descriptionInput",
	MEDIA: "fileUploadInput",
} as const;

const MODAL_IDS = {
	REPORT: "bug:report",
	EDIT: "bug:edit",
} as const;

const VALIDATION = {
	TITLE_MAX_LENGTH: 100,
	DESCRIPTION_MAX_LENGTH: 1000,
	THREAD_NAME_MAX_LENGTH: 50,
	AUTO_ARCHIVE_DURATION: 1440,
} as const;

// types
type ProjectChoice<T extends "name" | "label" = "name"> = T extends "name"
	? { name: string; value: string }
	: { label: string; value: string };

interface DownloadedMediaResult {
	media: MediaType[];
	totalSize: number;
}

// utils
function formatFileSize(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function truncateTitle(title: string, maxLength: number): string {
	return title.length > maxLength
		? `${title.substring(0, maxLength)}...`
		: title;
}

// media handling
async function downloadAttachment(
	attachment: Attachment,
	bugId: number,
	userId: Snowflake,
): Promise<MediaType> {
	if (!attachment.contentType) {
		throw new Error(`Attachment ${attachment.id} has no content type`);
	}

	try {
		const response = await fetch(attachment.url);
		if (!response.ok) {
			throw new Error(`Failed to download attachment: ${response.statusText}`);
		}

		const buffer = await response.arrayBuffer();
		const [mainType, subType] = attachment.contentType.split("/");
		const type = mainType === "image" ? "image" : "video";
		const extension = subType.split(";")[0];

		const media = new MediaModel({
			bug_id: bugId,
			user_id: userId,
			media_type: type,
			data: Buffer.from(buffer),
			extension,
		});

		await media.save();
		return media;
	} catch (error) {
		logger.error("Failed to download attachment", {
			error,
			attachmentId: attachment.id,
			bugId,
		});
		throw error;
	}
}

async function downloadAttachments(
	attachments: ReadonlyCollection<string, Attachment>,
	bugId: number,
	userId: Snowflake,
): Promise<DownloadedMediaResult> {
	const totalSize = Array.from(attachments.values()).reduce(
		(acc, att) => acc + att.size,
		0,
	);

	const mediaPromises = attachments.map((attachment) =>
		downloadAttachment(attachment, bugId, userId),
	);

	const media = await Promise.all(mediaPromises);

	return { media, totalSize };
}

// project choices
export function getProjectChoices<T extends "name" | "label" = "name">(
	label: T = "name" as T,
): ProjectChoice<T>[] {
	return Object.entries(PROJECT_MAP).map(([key, project]) =>
		label === "name"
			? { name: project.displayName, value: key }
			: { label: project.displayName, value: key },
	) as ProjectChoice<T>[];
}

// modal builders
function buildReportModal(): ModalBuilder {
	const terminology = config.data.terminology;
	const capitalizedTerminology =
		terminology.charAt(0).toUpperCase() + terminology.slice(1);

	const gameLabel = new LabelBuilder()
		.setLabel(capitalizedTerminology)
		.setDescription(`The ${terminology} affected by this bug`)
		.setStringSelectMenuComponent(
			new StringSelectMenuBuilder()
				.setMaxValues(1)
				.setMinValues(1)
				.setCustomId(INPUT_IDS.AFFECTED)
				.setPlaceholder(`Select the ${terminology} you encountered the bug in`)
				.addOptions(getProjectChoices("label")),
		);

	const titleLabel = new LabelBuilder()
		.setLabel("Bug Title")
		.setDescription("Provide a short description of the bug")
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId(INPUT_IDS.TITLE)
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(VALIDATION.TITLE_MAX_LENGTH),
		);

	const descriptionLabel = new LabelBuilder()
		.setLabel("Bug Description")
		.setDescription(
			"Provide a detailed description of the bug and steps to reproduce",
		)
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId(INPUT_IDS.DESCRIPTION)
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH),
		);

	const mediaLabel = new LabelBuilder()
		.setLabel("Media")
		.setDescription(
			"Provide any screenshots or videos that demonstrate the bug",
		)
		.setFileUploadComponent(
			new FileUploadBuilder().setCustomId(INPUT_IDS.MEDIA).setRequired(false),
		);

	return new ModalBuilder()
		.setCustomId(MODAL_IDS.REPORT)
		.setTitle("Report a Bug")
		.setLabelComponents(gameLabel, titleLabel, descriptionLabel, mediaLabel);
}

// validation
async function validateGuildSetup(interaction: ModalSubmitInteraction) {
	if (!interaction.guild) {
		throw new Error("This command can only be used in a server.");
	}

	const guildData = await GuildModel.findOne({
		guild_id: interaction.guild.id,
	});

	if (!guildData)
		throw new Error("Guild data not found. Please configure the bot first.");
	if (!guildData.bug_channel)
		throw new Error("The bug channel is not configured.");

	const channel = interaction.guild.channels.cache.get(guildData.bug_channel);
	if (!channel?.isTextBased() || !("send" in channel))
		throw new Error("The bug channel configured is not a valid text channel.");

	return { guildData, channel };
}

function parseModalCustomId(customId: string): { type: string } {
	const parts = customId.split(":");
	if (parts.length !== 2 || parts[0] !== "bug") {
		throw new Error("Invalid modal submission format.");
	}
	return { type: parts[1] };
}

// containers
function buildBugContainer(
	bug: InstanceType<typeof BugModel>,
	projectKey: string,
	userId: Snowflake,
	mediaUrls: string[],
): ContainerBuilder {
	const projectInfo = PROJECT_MAP[projectKey];
	if (!projectInfo) {
		throw new Error(`Project ${projectKey} not found in PROJECT_MAP`);
	}

	const textContent = `### ${bug.title}\n${bug.description}`;
	const footerContent = [
		`-# #${bug.bug_id}`,
		projectInfo.displayName,
		`Reported by <@${userId}>`,
	].join(" • ");

	const container = new ContainerBuilder().addSectionComponents(
		new SectionBuilder()
			.setThumbnailAccessory(
				new ThumbnailBuilder().setURL(projectInfo.iconURL || ""),
			)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(textContent),
			),
	);

	if (mediaUrls.length > 0) {
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(
				...mediaUrls.map((url) => new MediaGalleryItemBuilder().setURL(url)),
			),
		);
	}

	container.addTextDisplayComponents(
		new TextDisplayBuilder().setContent(footerContent),
	);

	return container;
}

// main
export async function execute(
	_client: Client,
	interaction: ChatInputCommandInteraction,
): Promise<void> {
	const modal = buildReportModal();
	await interaction.showModal(modal);
}

// modal submission handling
export async function modalExecute(
	client: Client,
	interaction: ModalSubmitInteraction,
): Promise<void> {
	try {
		if (!interaction.guild) {
			await interaction.reply({
				content: "❌ This command can only be used in a server.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const { type } = parseModalCustomId(interaction.customId);

		if (type === "edit") {
			await interaction.reply({
				content: "❌ Editing bugs is not implemented yet.",
				flags: ["Ephemeral"],
			});
			return;
		}

		const { channel } = await validateGuildSetup(interaction);
		await createUserIfNotExists(interaction.user.id, interaction.guild.id);

		// collect inputs & defer
		const title = interaction.fields.getTextInputValue(INPUT_IDS.TITLE);
		const description = interaction.fields.getTextInputValue(
			INPUT_IDS.DESCRIPTION,
		);
		const affected = interaction.fields
			.getStringSelectValues(INPUT_IDS.AFFECTED)
			.join("");
		const mediaFiles = interaction.fields.getUploadedFiles(INPUT_IDS.MEDIA);

		await interaction.deferReply({ flags: ["Ephemeral"] });

		// create record
		const bugId = await getNextBugId();
		const bug = new BugModel({
			bug_id: bugId,
			guild_id: interaction.guild.id,
			user_id: interaction.user.id,
			title,
			description,
			projects: affected,
			status: "open",
			sent: false,
		});
		await bug.save();

		logger.info("Bug report created", {
			bugId,
			userId: interaction.user.id,
			guildId: interaction.guild.id,
		});

		// handle media uploads
		let downloadedMedia: MediaType[] = [];
		if (mediaFiles && mediaFiles.size > 0) {
			const { media, totalSize } = await downloadAttachments(
				mediaFiles,
				bugId,
				interaction.user.id,
			);

			logger.info("Downloading attachments", {
				bugId,
				userId: interaction.user.id,
				fileCount: mediaFiles.size,
				totalSize,
			});

			await interaction.editReply({
				content: `⏳ Downloading ${mediaFiles.size} attachment(s) (${formatFileSize(totalSize)})... This may take a moment.`,
			});

			downloadedMedia = media;
		}

		// build message container
		const projectKey = affected.split(",")[0];
		const mediaUrls = mediaFiles
			? Array.from(mediaFiles.values()).map((att) => att.url)
			: [];
		const container = buildBugContainer(
			bug,
			projectKey,
			interaction.user.id,
			mediaUrls,
		);

		// send message to bug channel
		const message = await channel.send({
			components: [container],
			flags: "IsComponentsV2",
			files: downloadedMedia.map((media) =>
				new AttachmentBuilder(media.data).setName(
					`bug_${bugId}_media.${media.extension}`,
				),
			),
			allowedMentions: { users: [] },
		});

		// create thread
		const threadName = `#${bugId} ${truncateTitle(title, VALIDATION.THREAD_NAME_MAX_LENGTH)}`;
		const thread = await message.startThread({
			name: threadName,
			autoArchiveDuration: VALIDATION.AUTO_ARCHIVE_DURATION,
			reason: `Thread for bug report #${bugId}`,
		});

		await thread.send({
			content:
				"Use this space to discuss the bug, provide additional details, or ask questions.",
		});
		await thread.members.add(interaction.user.id);

		// update bug with message and thread IDs, add buttons
		bug.message_id = message.id;
		bug.thread_id = thread.id;
		await bug.save();

		const buttonRow = buildButtonRow(bugId, message.url, title, false);
		await message.edit({
			components: [container, buttonRow],
		});

		// final success message
		await interaction.editReply({
			content: `✅ Bug report #${bugId} has been submitted successfully! Check <#${channel.id}> for your report.`,
		});

		logger.info("Bug report submitted successfully", {
			bugId,
			messageId: message.id,
			threadId: thread.id,
		});
	} catch (error) {
		logger.error("Failed to process bug report", { error });

		const errorMessage =
			error instanceof Error ? error.message : "An unknown error occurred.";

		if (interaction.deferred || interaction.replied) {
			await interaction.editReply({
				content: `❌ ${errorMessage}`,
			});
		} else {
			await interaction.reply({
				content: `❌ ${errorMessage}`,
				flags: ["Ephemeral"],
			});
		}
	}
}

export const reportCommand = {
	execute,
	modalExecute,
	getProjectChoices,
};
