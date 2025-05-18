import type {
	ApplicationCommandData,
	AutocompleteInteraction,
	BaseInteraction,
	ButtonInteraction,
	Client,
	ModalSubmitInteraction,
	StringSelectMenuInteraction,
} from "discord.js";

import type { Model } from "sequelize";

export interface IEvent {
	event: string;
	execute: (client: Client, ...args: unknown[]) => Promise<void>;
	once?: boolean;
}

export interface ICommand {
	data: ApplicationCommandData;
	execute: (client: Client, interaction: BaseInteraction) => Promise<void>;
	autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
	buttonExecute?: (
		client: Client,
		interaction: ButtonInteraction,
	) => Promise<void>;
	modalExecute?: (
		client: Client,
		interaction: ModalSubmitInteraction,
	) => Promise<void>;
	selectMenuExecute?: (
		client: Client,
		interaction: StringSelectMenuInteraction,
	) => Promise<void>;
}
