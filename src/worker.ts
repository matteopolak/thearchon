import fs from 'fs/promises';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';
import { createClient } from 'minecraft-protocol';
import { SocksClient } from 'socks';
import { SocksProxyAgent } from 'socks-proxy-agent';

import FishBot from './classes/FishBot';
import type { BaseBotOptions } from './typings';

const { options }: { options: BaseBotOptions } = workerData;

if (options.proxy !== undefined) {
	const [proxyHost, _proxyPort] = options.proxy.slice(9).split(':');
	const proxyPort = parseInt(_proxyPort);

	options.client = createClient({
		username: options.username,
		password: options.password,
		host: options.host,
		port: options.port,
		connect: async client => {
			const info = await SocksClient.createConnection({
				proxy: {
					host: proxyHost,
					port: proxyPort,
					type: parseInt(options.proxy![5]) as 4 | 5,
				},
				command: 'connect',
				destination: {
					host: options.host!,
					port: options.port!,
				},
			});

			client.setSocket(info.socket);
			client.emit('connect');
		},
		agent: new SocksProxyAgent(options.proxy),
	});
}

const bot = new FishBot(options, parentPort!);

console.log(
	`${' '.repeat(17)}${chalk.bold(chalk.cyan('Worker'))} Starting ${chalk.yellow(
		options.alias,
	)}${options.proxy ? ` with proxy ${chalk.yellow(options.proxy)}` : ''}`,
);

const logFileLocation = path.join(bot.directory, 'latest.log');

bot._bot.on('messagestr', message => {
	if (message.startsWith('██')) return;

	const date = new Date();
	const format = `${date.getHours().toString().padStart(2, '0')}:${date
		.getMinutes()
		.toString()
		.padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;

	const messages = message
		.split('\n')
		.map(message => `[${format}] [Client thread/INFO] ${message}`);

	fs.appendFile(logFileLocation, messages.join('\n'));
});

bot._bot.on('kicked', async reason => {
	bot.logger.error(`Kicked: ${chalk.redBright(reason)}`);

	process.exit(0);
});

bot._bot.on('end', async reason => {
	bot.logger.error(`Ended: ${chalk.redBright(reason)}`);

	process.exit(reason === 'socketClosed' ? 1 : 0);
});

bot.init();
