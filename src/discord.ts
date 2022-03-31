import type { Worker } from 'worker_threads';

import chalk from 'chalk';
import { Client, Intents } from 'discord.js';

import type { DiscordConfig, ParentMessage } from './typings';

export function create(config: DiscordConfig, workers: Map<string, Worker>) {
	const client = new Client({
		intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
	});

	client.once('ready', () => {
		console.log(
			`${' '.repeat(17)}${chalk.bold(
				chalk.cyan('Parent'),
			)} Discord bot logged in as ${chalk.green(client.user!.username)}`,
		);
	});

	client.on('messageCreate', async message => {
		if (!message.content.startsWith(config.prefix)) return;
		if (!config.whitelist.includes(message.author.id)) return;

		const [command, username, ...args] = message.content
			.slice(config.prefix.length)
			.split(/ +/);

		if (!command || !username) {
			return void message.channel.send(
				`Please provide the command in the following form:\n\`${config.prefix}<command> <username> [arguments]\``,
			);
		}

		const payload: ParentMessage = {
			command,
			args,
			sender: username,
		};

		for (const worker of workers.values()) {
			worker.postMessage(payload);
		}

		return void message.channel.send(
			`Executed command \`${command}\` with username \`${username}\`.`,
		);
	});

	client.login(config.token);

	return client;
}
