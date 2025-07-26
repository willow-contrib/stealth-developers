import { type Client, Collection } from "discord.js";
import type { IEvent } from "../types.ts";
import lily from "../utils/logging.ts";
import { crawlDirectory, getHandlerPath } from "./common.ts";

const logger = lily.child("events");

async function getEvents(): Promise<Collection<string, IEvent>> {
	const eventFiles = new Collection<string, IEvent>();

	const processFile = async (fileUrl: string) => {
		const { default: event } = await import(fileUrl);
		eventFiles.set(event.event, event);
		return event;
	};

	await crawlDirectory<IEvent>(getHandlerPath("events"), processFile);
	return eventFiles;
}

async function registerEvents(client: Client) {
	const events = await getEvents();
	if (events.size === 0) return logger.warn("no events found");
	logger.info(`found ${events.size} events.`);

	for (const event of events.values()) {
		logger.info(`registering event: ${event.event}`);
		client[event.once ? "once" : "on"](
			event.event,
			event.execute.bind(null, client),
		);
	}

	logger.info(`registered ${events.size} events`);
}

export default registerEvents;
export { logger };
