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
	if (!config.data.roblox) throw new Error("roblox API key is not configured");

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
	if (!config.data.bloxlink)
		throw new Error("bloxlink token is not configured");

	const response = await fetch(
		`https://api.blox.link/v4/public/discord-to-roblox/${discordId}`,
		{
			headers: {
				Authorization: config.data.bloxlink.token,
			},
		},
	);

	return await response.json();
}
