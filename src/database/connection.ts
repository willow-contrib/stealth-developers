import mongoose from "mongoose";
import cfg from "../config.ts";
import { Logger } from "../utils/logging.ts";

const logger = new Logger("database");

export async function connectDatabase() {
	try {
		logger.info("connecting to mongodb...");
		await mongoose.connect(cfg.data.mongodb.uri, {
			dbName: cfg.data.mongodb.database,
		});
		logger.info("connected to mongodb");
	} catch (error) {
		logger.error("failed to connect to mongodb:", error);
		process.exit(1);
	}
}

export async function disconnectDatabase() {
	await mongoose.disconnect();
	logger.info("disconnected from mongodb");
}
