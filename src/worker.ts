import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';
import { createClient } from 'minecraft-protocol';
import ProxyAgent from 'proxy-agent';

import FishBot from './classes/FishBot';
import type { BaseBotOptions } from './typings';

const { options }: { options: BaseBotOptions } = workerData;

if (options.proxy && options.protocol) {
	const [proxyHost, proxyPort] = options.proxy.split(':');

	options.client = createClient({
		username: options.username,
		password: options.password,
		host: options.host,
		port: options.port,
		connect: client => {
			const req = http.request({
				host: proxyHost,
				port: parseInt(proxyPort),
				method: 'CONNECT',
				path: `${options.host}:${options.port}`,
			});

			req.end();
			req.on('connect', (_, stream) => {
				client.setSocket(stream);
				client.emit('connect');
			});
		},
		agent: new ProxyAgent(`${options.protocol}://${options.proxy}`),
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
