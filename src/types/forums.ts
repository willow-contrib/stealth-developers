export type ForumComment = {
	id: string;
	parentId: string;
	content: {
		plainText: string;
	};
	createdBy: number;
	creatorDisplayName: string | null;
	createdtAt: string;
	updatedAt: string | null;
	deletedAt: string | null;
	threadId: string | null;
	reactions: [];
	threadCommentCount: null | number;
	threadComments: null | ForumComment[];
};

export type ForumCommentCreator = {
	displayName: string;
	groupRoleName: string | null;
	hasVerifiedBadge: boolean;
};

export type Post = {
	categoryId: string;
	isLocked: boolean;
	isPinned: boolean;
	isUnread: boolean;
	commentCount: number;
	notificationPreference: null;
	id: string;
	/** title of the post */
	name: string;
	groupId: number;
	description: string | null;
	channelType: string | null;
	parentChannelId: string | null;
	createdBy: number;
	createdAt: string;
	updatedAt: string;
	deletedAt: string | null;
	archivedAt: string | null;
	archivedBy: number | null;
	/** represents the post's body */
	firstComment: ForumComment;
};

export type GetPosts = {
	previousPageCursor: string | null;
	nextPageCursor: string | null;
	data: Post[];
};
