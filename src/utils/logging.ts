import { Logger as Lily } from "@sillowww/lily";
const lily = new Lily("bot");

const loggers = {
	events: lily.child("Events"),
	interactions: lily.child("Interactions"),
};

export default lily;
export { loggers };
