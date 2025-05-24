import { type Document, Schema, model } from "mongoose";
import { z } from "zod";

// zod schemas for validation
export const guildSchema = z.object({
	guild_id: z.string(),
	suggestion_forum: z.string().optional(),
	bug_channel: z.string().optional(),
	commands_channel: z.string().optional(),
	highlights_channel: z.string().optional(),
	manager_roles: z.array(z.string()).default([]),
});

export const userSchema = z.object({
	user_id: z.string(),
	guild_id: z.string(),
});

export const bugSchema = z.object({
	user_id: z.string(),
	status: z.enum(["open", "closed"]).default("open"),
	title: z.string(),
	description: z.string(),
	sent: z.boolean().default(false),
	message_id: z.string().optional(),
});

export const mediaSchema = z.object({
	media_type: z.enum(["image", "video"]),
	data: z.instanceof(Buffer),
	user_id: z.string(),
	bug_id: z.string().optional(),
});

// ts types
export type Guild = z.infer<typeof guildSchema> & Document;
export type User = z.infer<typeof userSchema> & Document;
export type Bug = z.infer<typeof bugSchema> & Document;
export type Media = z.infer<typeof mediaSchema> & Document;

// mongoose schemas
const GuildSchema = new Schema(
	{
		guild_id: { type: String, required: true, unique: true },
		suggestion_forum: String,
		bug_channel: String,
		commands_channel: String,
		highlights_channel: String,
		manager_roles: [String],
	},
	{ timestamps: true },
);

const UserSchema = new Schema(
	{
		user_id: { type: String, required: true },
		guild_id: { type: String, required: true, ref: "Guild" },
	},
	{ timestamps: true },
);

const BugSchema = new Schema(
	{
		user_id: { type: String, required: true, ref: "User" },
		status: { type: String, enum: ["open", "closed"], default: "open" },
		title: { type: String, required: true },
		description: { type: String, required: true },
		sent: { type: Boolean, default: false },
		message_id: String,
	},
	{ timestamps: true },
);

const MediaSchema = new Schema(
	{
		media_type: { type: String, enum: ["image", "video"], required: true },
		data: { type: Buffer, required: true },
		user_id: { type: String, required: true, ref: "User" },
		bug_id: { type: String, ref: "Bug" },
	},
	{ timestamps: true },
);

// compound indexes for better perf
UserSchema.index({ user_id: 1, guild_id: 1 }, { unique: true });

// models
export const GuildModel = model<Guild>("Guild", GuildSchema);
export const UserModel = model<User>("User", UserSchema);
export const BugModel = model<Bug>("Bug", BugSchema);
export const MediaModel = model<Media>("Media", MediaSchema);
