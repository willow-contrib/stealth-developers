import config from "@/config";
import type {
	BLApiResponse,
	GetUserResponse,
	ThumbnailResponse,
} from "@/types/roblox";

export async function getRobloxUser(userId: string): Promise<{
	user: GetUserResponse;
	thumbnail: ThumbnailResponse;
}> {
	const getUserUrl = `https://apis.roblox.com/cloud/v2/users/${userId}`;
	const getThumbnailUrl = `https://apis.roblox.com/cloud/v2/users/${userId}:generateThumbnail`;
	const [userRes, thumbnailRes] = await Promise.all([
		fetch(getUserUrl, {
			headers: {
				"Content-Type": "application/json",
				"x-api-key": config.data.roblox.apiKey,
			},
		}),
		fetch(getThumbnailUrl, {
			headers: {
				"Content-Type": "application/json",
				"x-api-key": config.data.roblox.apiKey,
			},
		}),
	]);

	const [userData, thumbnailData] = await Promise.all([
		userRes.json(),
		thumbnailRes.json(),
	]);

	return { user: userData, thumbnail: thumbnailData };
}

export async function getConnectedRobloxUser(
	discordId: string,
): Promise<BLApiResponse> {
	const getUserUrl = `https://api.blox.link/v4/public/discord-to-roblox/${discordId}`;

	const response = await fetch(getUserUrl, {
		headers: {
			Authorization: config.data.bloxlink.token,
		},
	});

	return await response.json();
}
