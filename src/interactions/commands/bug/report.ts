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
	ComponentType,
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

import { buildButtonRow, canManageBug } from "./buttons.ts";
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
	: { label: string; value: string; default: boolean };

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
	defaultProjectKey?: string,
): ProjectChoice<T>[] {
	return Object.entries(PROJECT_MAP).map(([key, project]) =>
		label === "name"
			? { name: project.displayName, value: key }
			: {
					label: project.displayName,
					value: key,
					default: key === defaultProjectKey,
				},
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

function buildEditModal(
	bugId: number,
	currentTitle: string,
	currentDescription: string,
	currentProject: string,
): ModalBuilder {
	const terminology = config.data.terminology;
	const capitalizedTerminology =
		terminology.charAt(0).toUpperCase() + terminology.slice(1);

	const projectOptions = getProjectChoices("label", currentProject);
	const selectedProject = projectOptions.find(
		(opt) => opt.value === currentProject,
	);

	const gameLabel = new LabelBuilder()
		.setLabel(capitalizedTerminology)
		.setDescription(`The ${terminology} affected by this bug`)
		.setStringSelectMenuComponent(
			new StringSelectMenuBuilder()
				.setMaxValues(1)
				.setMinValues(1)
				.setCustomId(INPUT_IDS.AFFECTED)
				.setPlaceholder(selectedProject?.label || `Select the ${terminology}`)
				.addOptions(projectOptions),
		);

	const titleLabel = new LabelBuilder()
		.setLabel("Bug Title")
		.setDescription("Update the bug title")
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId(INPUT_IDS.TITLE)
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(VALIDATION.TITLE_MAX_LENGTH)
				.setValue(currentTitle),
		);

	const descriptionLabel = new LabelBuilder()
		.setLabel("Bug Description")
		.setDescription("Update the bug description")
		.setTextInputComponent(
			new TextInputBuilder()
				.setCustomId(INPUT_IDS.DESCRIPTION)
				.setStyle(TextInputStyle.Paragraph)
				.setRequired(true)
				.setMaxLength(VALIDATION.DESCRIPTION_MAX_LENGTH)
				.setValue(currentDescription),
		);

	return new ModalBuilder()
		.setCustomId(`${MODAL_IDS.EDIT}:${bugId}`)
		.setTitle(`Edit Bug #${bugId}`)
		.setLabelComponents(gameLabel, titleLabel, descriptionLabel);
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

function parseModalCustomId(customId: string): {
	type: string;
	bugId?: number;
} {
	const parts = customId.split(":");
	if (parts.length < 2 || parts[0] !== "bug") {
		throw new Error("Invalid modal submission format.");
	}

	const type = parts[1];
	const bugId = parts[2] ? Number.parseInt(parts[2]) : undefined;

	return { type, bugId };
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

// modals handlers
async function handleEditModal(
	client: Client,
	interaction: ModalSubmitInteraction,
	bugId: number,
): Promise<void> {
	if (!interaction.guild) {
		await interaction.reply({
			content: "❌ This command can only be used in a server.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const bug = await BugModel.findOne({ bug_id: bugId });
	if (!bug) {
		await interaction.reply({
			content: "❌ Bug report not found.",
			flags: ["Ephemeral"],
		});
		return;
	}

	const canManage = await canManageBug(interaction, bug.user_id);
	if (!canManage) {
		await interaction.reply({
			content: "❌ You don't have permission to edit this bug report.",
			flags: ["Ephemeral"],
		});
		return;
	}

	await interaction.deferReply({ flags: ["Ephemeral"] });

	try {
		// collect inputs
		const newTitle = interaction.fields.getTextInputValue(INPUT_IDS.TITLE);
		const newDescription = interaction.fields.getTextInputValue(
			INPUT_IDS.DESCRIPTION,
		);
		const newProject = interaction.fields
			.getStringSelectValues(INPUT_IDS.AFFECTED)
			.join("");

		// track changes
		const changes: string[] = [];
		if (bug.title !== newTitle) changes.push("title");
		if (bug.description !== newDescription) changes.push("description");
		if (bug.projects.join(",") !== newProject) changes.push("project");

		if (changes.length === 0) {
			await interaction.editReply({
				content: "❌ No changes were made to the bug report.",
			});
			return;
		}

		bug.title = newTitle;
		bug.description = newDescription;
		bug.projects = [newProject];
		await bug.save();

		if (bug.message_id && bug.thread_id) {
			const thread = await client.channels.fetch(bug.thread_id);
			if (thread?.isThread()) {
				const message = await thread.fetchStarterMessage();
				if (message) {
					const projectKey = newProject.split(",")[0];

					const existingMediaUrls = Array.from(message.components.values())
						.filter((comp) => comp.type === ComponentType.Container)
						.flatMap((comp) => Array.from(comp.components.values()))
						.filter((item) => item.type === ComponentType.MediaGallery)
						.flatMap((item) => Array.from(item.items.values()))
						.map((mediaItem) => mediaItem.media.url);

					// build updated container & edit message
					const storedMedia = await MediaModel.find({ bug_id: bugId });
					const container = buildBugContainer(
						bug,
						projectKey,
						bug.user_id,
						existingMediaUrls,
					);

					const buttonRow = buildButtonRow(
						bugId,
						message.url,
						bug.title,
						bug.status === "closed",
					);

					const mediaAttachments = storedMedia.map((media) =>
						new AttachmentBuilder(media.data).setName(
							`bug_${bugId}_media.${media.extension}`,
						),
					);

					await message.edit({
						components: [container, buttonRow],
						files: mediaAttachments.length > 0 ? mediaAttachments : undefined,
					});

					// update thread name if title changed
					if (changes.includes("title")) {
						const newThreadName = `#${bugId} ${truncateTitle(bug.title, VALIDATION.THREAD_NAME_MAX_LENGTH)}`;
						await thread.setName(newThreadName);
					}

					const editLogMessage = `Bug report edited by <@${interaction.user.id}> • **Changes:** ${changes.join(", ")} • <t:${Math.floor(Date.now() / 1000)}:R>`;
					await thread.send({
						content: editLogMessage,
						allowedMentions: { users: [] },
					});
				}
			}
		}

		await interaction.editReply({
			content: `✅ Bug report #${bugId} has been updated successfully!\n**Changed:** ${changes.join(", ")}`,
		});

		logger.info("Bug report edited successfully", {
			bugId,
			editedBy: interaction.user.id,
			changes,
		});
	} catch (error) {
		logger.error("Failed to edit bug report", { error, bugId });

		const errorMessage =
			error instanceof Error ? error.message : "An unknown error occurred.";

		await interaction.editReply({
			content: `❌ ${errorMessage}`,
		});
	}
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

		const { type, bugId: _bugId } = parseModalCustomId(interaction.customId);

		if (type === "edit") {
			if (!_bugId) {
				await interaction.reply({
					content: "❌ Invalid bug ID.",
					flags: ["Ephemeral"],
				});
				return;
			}
			await handleEditModal(client, interaction, _bugId);
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

export async function showEditModal(
	bugId: number,
	currentTitle: string,
	currentDescription: string,
	currentProject: string,
	interaction: { showModal: (modal: ModalBuilder) => Promise<void> },
): Promise<void> {
	const modal = buildEditModal(
		bugId,
		currentTitle,
		currentDescription,
		currentProject,
	);
	await interaction.showModal(modal);
}

export const reportCommand = {
	execute,
	modalExecute,
	getProjectChoices,
	showEditModal,
};
