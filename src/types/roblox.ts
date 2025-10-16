type V2ErrorCode =
	| "INVALID_ARGUMENT"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "ABORTED"
	| "RESOURCE_EXHAUSTED"
	| "CANCELLED"
	| "INTERNAL"
	| "NOT_IMPLEMENTED"
	| "UNAVAILABLE";

interface V2ErrorResponse {
	code: V2ErrorCode;
	message: string;
	details: Array<Record<string, unknown>>;
}

// v1 resource err model
export type V1ErrorCode =
	| "INVALID_ARGUMENT"
	| "INSUFFICIENT_SCOPE"
	| "PERMISSION_DENIED"
	| "NOT_FOUND"
	| "ABORTED"
	| "RESOURCE_EXHAUSTED"
	| "CANCELLED"
	| "INTERNAL"
	| "NOT_IMPLEMENTED"
	| "UNAVAILABLE";

export interface V1ErrorResponse {
	error: V1ErrorCode;
	message: string;
	errorDetails: Array<{
		errorDetailType: string;
		[key: string]: unknown;
	}>;
}

// OrderedDataStores err model
export interface OrderedDataStoresErrorResponse {
	code: V1ErrorCode;
	message: string;
}

// UserSearch api
export interface UserSearchParams {
	keyword: string;
	sessionId?: string;
	limit?: 10 | 25 | 50 | 100;
	cursor?: string;
}

export type UserSearchResponse =
	| UserSearchOkResponse
	| UserSearchBadResponse
	| UserSearchRateLimitResponse;

export type BLApiResponse =
	| {
			robloxID: string;
			resolved: object;
	  }
	| {
			error: "User not found";
	  };

export type ThumbnailResponse =
	| {
			done: true;
			response: { imageUri: string };
	  }
	| {
			done: false;
	  };

export interface UserSearchPlayer {
	previousUsernames: string[];
	hasVerifiedBadge: boolean;
	id: number;
	name: string;
	displayName: string;
}

export interface UserSearchOkResponse {
	previousPageCursor: string | null;
	nextPageCursor: string | null;
	data: Array<UserSearchPlayer>;
}

export interface UserSearchBadResponse {
	statusCode: 400;
	error: "INVALID_ARGUMENT";
	message: "The keyword was filtered." | "The keyword is too short.";
}

export interface UserSearchRateLimitResponse {
	statusCode: 429;
	error: "RESOURCE_EXHAUSTED";
	message: "Too many requests.";
}

export type UserSearchError =
	| UserSearchBadResponse
	| UserSearchRateLimitResponse;

export interface GetUserOkResponse {
	path: string;
	/** RFC 3339 formatted date string */
	createTime: string;
	id: string;
	name: string;
	displayName: string | null;
	about?: string;
	locale: string;
	premium: boolean;
	idVerified?: boolean;
	socialNetworkProfiles: {
		facebook?: string;
		twitter?: string;
		youtube?: string;
		twitch?: string;
		guilded?: string;
		visibility:
			| "SOCIAL_NETWORK_VISIBILITY_UNSPECIFIED"
			| "NO_ONE"
			| "FRIENDS"
			| "FRIENDS_AND_FOLLOWING"
			| "FRIENDS_FOLLOWING_AND_FOLLOWERS"
			| "EVERYONE";
	};
}

export type GetUserResponse = GetUserOkResponse | V2ErrorResponse;

export interface RobloxSearchUser {
	previousUsernames: string[];
	hasVerifiedBadge: boolean;
	id: number;
	name: string;
	displayName: string;
}

export interface RobloxSearchResponse {
	previousPageCursor: string | null;
	nextPageCursor: string | null;
	data: RobloxSearchUser[];
}

export type AvatarSize =
	| 48
	| 50
	| 60
	| 75
	| 100
	| 110
	| 150
	| 180
	| 352
	| 420
	| 720;
