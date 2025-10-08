import config from "@/config";
import type { GetUserResponse } from "@/types/roblox";
import lily from "@/utils/logging";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";

const logger = lily.child("bans");
const projects = Object.values(config.data.projects);
const BASE_URL = "https://apis.roblox.com/user/cloud/v2/universes";

export type Restriction = {
	active: true | false;
	startTime: string;
	privateReason: string;
	displayReason: string;
	excludeAltAccounts: boolean;
	inherited: boolean;
};

export type GetBansResponse = {
	path: string;
	user: string;
	gameJoinRestriction: Restriction;
};

export type GetBansResponseWithProject = GetBansResponse & {
	project: string;
};

export async function getBans(
	userId: string,
): Promise<GetBansResponseWithProject[] | null> {
	if (!config.data.roblox?.cookie) return null;

	const fetches = projects.map(async (project) => {
		const url = `${BASE_URL}/${project.universe}/user-restrictions/${userId}`;
		const bans = await fetch(url, {
			headers: {
				Cookie: config.data.roblox?.cookie || "",
			},
		});

		if (!bans.ok) {
			logger.error(
				`failed to fetch bans for user ${userId} in project ${project.name}:`,
				bans.statusText,
			);
			return null;
		}

		const data: GetBansResponse = await bans.json();
		return { ...data, project: project.displayName };
	});

	const results = await Promise.all(fetches);
	const bansArray = results.filter(
		(data): data is GetBansResponseWithProject => data !== null,
	);

	return bansArray;
}

export async function buildBansContainer(
	user: GetUserResponse,
): Promise<ContainerBuilder> {
	const bansContainer = new ContainerBuilder();
	{
		const bansTitle = new TextDisplayBuilder().setContent(
			`**Bans for ${user.displayName || user.name}**`,
		);

		const bans = await getBans(user.id);

		const constructBan = (ban: GetBansResponseWithProject) => {
			if (!ban.gameJoinRestriction.active) {
				return new TextDisplayBuilder().setContent(
					`**${ban.project}**: no active ban`,
				);
			}

			const restriction: Restriction = ban.gameJoinRestriction;
			return new TextDisplayBuilder().setContent(
				[
					`**${ban.project}**`,
					`> **Active since** <t:${Math.round(new Date(restriction.startTime).getTime() / 1000)}:R>`,
					`> **Display reason:** ${restriction.displayReason}`,
					`> **Reason:** ${restriction.privateReason}`,
				].join("\n"),
			);
		};

		if (bans && bans.length > 0) {
			const banComponents = bans.map(constructBan);
			bansContainer.addTextDisplayComponents(bansTitle, ...banComponents);
		} else {
			bansContainer.addTextDisplayComponents(
				bansTitle,
				new TextDisplayBuilder().setContent(
					"no active bans found for this user",
				),
			);
		}
	}

	return bansContainer;
}
