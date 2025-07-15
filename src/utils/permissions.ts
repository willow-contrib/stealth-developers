import type { APIGuildMember, GuildMember } from "discord.js";
import { GuildModel } from "../database/schemas.ts";

export async function hasManagerPermissions(
	member: GuildMember | APIGuildMember,
): Promise<boolean> {
	if (
		member.permissions.has("ManageGuild") ||
		member.guild.ownerId === member.id
	) {
		return true;
	}

	const guild = await GuildModel.findOne({
		guild_id: member.guild.id,
	});

	if (!guild || guild.manager_roles.length === 0) {
		return false;
	}

	return member.roles.cache.some((role) =>
		guild.manager_roles.includes(role.id),
	);
}
