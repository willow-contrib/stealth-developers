import {
	type HydratedDocument,
	type InferSchemaType,
	Schema,
	model,
} from "mongoose";
import config from "../config";
const uniqueProjects = Object.keys(config.data.projects) as [
	string,
	...string[],
];

// mongoose schemas
const CounterSchema = new Schema({
	_id: String,
	sequence_value: { type: Number, default: 0 },
});

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
		cat_points: { type: Number, default: 0 },
	},
	{ timestamps: true },
);

const BugSchema = new Schema(
	{
		bug_id: { type: Number, required: true, unique: true },
		user_id: { type: String, required: true, ref: "User" },
		status: { type: String, enum: ["open", "closed"], default: "open" },
		title: { type: String, required: true },
		project: { type: String, enum: uniqueProjects, required: true },
		description: { type: String, required: true },
		sent: { type: Boolean, default: false },
		message_id: String,
		thread_id: String,
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

// types
export type GuildType = HydratedDocument<InferSchemaType<typeof GuildSchema>>;
export type UserType = HydratedDocument<InferSchemaType<typeof UserSchema>>;
export type BugType = HydratedDocument<InferSchemaType<typeof BugSchema>>;
export type MediaType = HydratedDocument<InferSchemaType<typeof MediaSchema>>;

// models
export const GuildModel = model<GuildType>("Guild", GuildSchema);
export const UserModel = model<UserType>("User", UserSchema);
export const BugModel = model<BugType>("Bug", BugSchema);
export const MediaModel = model<MediaType>("Media", MediaSchema);
export const CounterModel = model("Counter", CounterSchema);

// funcs
export async function getNextBugId(): Promise<number> {
	const counter = await CounterModel.findByIdAndUpdate(
		"bug_id",
		{ $inc: { sequence_value: 1 } },
		{ new: true, upsert: true },
	);
	return counter.sequence_value;
}
