import { UserModel } from "../database/schemas";
import { Logger } from "../utils/logging";

const logger = new Logger("exists");

export async function createUserIfNotExists(userId: string, guildId: string) {
	let user = await UserModel.findOne({
		user_id: userId,
		guild_id: guildId,
	});

	if (!user) {
		user = new UserModel({
			user_id: userId,
			guild_id: guildId,
		});
		await user.save();
		logger.info(`created new user record for ${userId}`);
	}

	return user;
}
