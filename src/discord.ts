import type { Worker } from 'worker_threads';

import chalk from 'chalk';
import { Client, Intents } from 'discord.js';

import config from './config';
import type { DiscordConfig, ParentMessage } from './typings';

export function create(
	discordConfig: DiscordConfig,
	workers: Map<string, Worker>,
) {
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
		if (!message.content.startsWith(discordConfig.prefix)) return;
		if (!discordConfig.whitelist.includes(message.author.id)) return;

		const [command, username, ...args] = message.content
			.slice(discordConfig.prefix.length)
			.split(/ +/);

		if (!command || !username) {
			return void message.channel.send(
				`Please provide the command in the following form:\n\`${discordConfig.prefix}<command> <username> [arguments]\``,
			);
		}

		const payload: ParentMessage = {
			command,
			args,
			sender: username,
		};

		const filtered = config.accounts.filter(
			a => !a.channels?.length || a.channels.includes(message.channel.id),
		);

		if (filtered.length > 0) {
			for (const account of filtered.values()) {
				const worker = workers.get(account.alias)!;

				worker.postMessage(payload);
			}

			const names = filtered.map(n => `\`${n.alias}\``).join(', ');

			return void message.channel.send(
				`Executed command \`${command}\` with username \`${username}\` to the following workers:\n${names}`,
			);
		}

		return void message.channel.send(
			`Command \`${command}\` was not sent to any workers.`,
		);
	});

	client.login(discordConfig.token);

	return client;
}
