import config from "@/config";

export function getProjectChoices() {
	return Object.entries(config.data.projects).map(([key, project]) => ({
		name: project.displayName,
		value: key,
	}));
}
