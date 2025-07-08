import config from "@/config";
import type {
	AvatarSize,
	BLApiResponse,
	GetUserResponse,
	RobloxSearchResponse,
	RobloxSearchUser,
	ThumbnailResponse,
} from "@/types/roblox";

export async function getRobloxUser(
	userId: string,
	size: AvatarSize = 420,
): Promise<{
	user: GetUserResponse;
	thumbnail: ThumbnailResponse;
}> {
	if (!config.data.roblox) throw new Error("roblox API key is not configured");

	const getUserUrl = `https://apis.roblox.com/cloud/v2/users/${userId}`;
	const getThumbnailUrl = `https://apis.roblox.com/cloud/v2/users/${userId}:generateThumbnail?size=${size}`;
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

export async function getRobloxIdFromUsername(
	username: string,
): Promise<string | null> {
	try {
		const response = await fetch(
			"https://users.roblox.com/v1/usernames/users",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					usernames: [username],
					excludeBannedUsers: true,
				}),
			},
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		if (data.data && data.data.length > 0 && data.data[0].id) {
			return data.data[0].id.toString();
		}

		return null;
	} catch (error) {
		return null;
	}
}

export async function searchRobloxUsers(
	keyword: string,
	limit = 10,
): Promise<{ users: RobloxSearchUser[]; error?: string; code?: number }> {
	try {
		const response = await fetch(
			`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=${limit}`,
			{
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					...(config.data.roblox?.cookie
						? { Cookie: config.data.roblox.cookie }
						: {}),
				},
			},
		);

		if (!response.ok) {
			return { users: [], error: response.statusText, code: response.status };
		}

		const data: RobloxSearchResponse = await response.json();
		return { users: data.data || [] };
	} catch (error) {
		return { users: [], error: "failed to search users" };
	}
}
