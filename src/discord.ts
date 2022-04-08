import type { Worker } from 'worker_threads';

import chalk from 'chalk';
import { Client, Intents } from 'discord.js';

import config from './config';
import type { DiscordConfig, ParentMessage } from './typings';

export function create(
	discordConfig: DiscordConfig,
	workers: Map<string, Worker>,
) {
	const channelToWorkers = new Map<string, Worker[]>();

	for (const account of config.accounts) {
		if (!account.channels?.length) continue;

		for (const channel of account.channels) {
			if (!channelToWorkers.has(channel)) {
				channelToWorkers.set(channel, [workers.get(account.alias)!]);
			} else {
				channelToWorkers.get(channel)!.push(workers.get(account.alias)!);
			}
		}
	}

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

		const participants =
			channelToWorkers.size === 0
				? workers
				: channelToWorkers.get(message.channel.id);

		if (participants) {
			for (const worker of participants.values()) {
				worker.postMessage(payload);
			}

			const names = [...participants.keys()].map(n => `\`${n}\``).join(', ');

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
