import { parentPort, workerData } from 'worker_threads';

import chalk from 'chalk';
import { createClient } from 'minecraft-protocol';
import { mineflayer as viewer } from 'prismarine-viewer';
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

if (options.viewer_port !== undefined) {
	viewer(bot._bot, { port: options.viewer_port });
}

console.log(
	`${' '.repeat(17)}${chalk.bold(chalk.cyan('Worker'))} Starting ${chalk.yellow(
		options.alias,
	)}${options.proxy ? ` with proxy ${chalk.yellow(options.proxy)}` : ''}`,
);

bot._bot.on('kicked', async reason => {
	bot.logger.error(`Kicked: ${chalk.redBright(reason)}`);

	process.exit(reason.includes('BANNED') ? 1 : 0);
});

bot._bot.on('end', async reason => {
	bot.logger.error(`Ended: ${chalk.redBright(reason)}`);

	process.exit(0);
});

bot.init();
